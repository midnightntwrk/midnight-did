import { setTimeout as delay } from 'node:timers/promises';

import { expect, type Page,test } from '@playwright/test';

import { type ManagerE2EEnv,startManagerE2EEnv } from './test-env.js';

let env: ManagerE2EEnv;

const matchesReference = (value: string | undefined, suffix: string): boolean =>
  typeof value === 'string' && (value === suffix || value.endsWith(suffix));

const clickAndWaitForJsonResponse = async <T>(
  page: Page,
  triggerSelector: string,
  predicate: (url: URL, method: string) => boolean,
): Promise<T> => {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return predicate(url, response.request().method());
  });
  await page.locator(triggerSelector).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return await response.json() as T;
};

const waitForOperation = async <T>(
  page: Page,
  operationId: string,
): Promise<T> => {
  const deadline = Date.now() + 300_000;
  let lastPayload: unknown;

  while (Date.now() < deadline) {
    const response = await page.request.get(`${env.baseUrl}/api/operations/${operationId}`);
    expect(response.ok()).toBe(true);
    lastPayload = await response.json();
    const operation = (lastPayload as { data?: { status?: string; result?: T; error?: { message?: string } } }).data;
    if (operation?.status === 'succeeded') {
      return operation.result as T;
    }
    if (operation?.status === 'failed') {
      throw new Error(`Operation ${operationId} failed: ${operation.error?.message ?? 'unknown error'}`);
    }
    await delay(1_500);
  }

  throw new Error(`Timed out waiting for operation ${operationId}.\nLast payload:\n${JSON.stringify(lastPayload, null, 2)}`);
};

const clickAndWaitForOperationResult = async <T>(
  page: Page,
  triggerSelector: string,
  predicate: (url: URL, method: string) => boolean,
): Promise<T> => {
  const accepted = await clickAndWaitForJsonResponse<{ data: { id: string } }>(page, triggerSelector, predicate);
  return await waitForOperation<T>(page, accepted.data.id);
};

const clickAndWaitForOperationResultWithRetry = async <T>(
  page: Page,
  triggerSelector: string,
  predicate: (url: URL, method: string) => boolean,
  options: {
    retries: number;
    retryOnMessage: RegExp;
    delayMs?: number;
  },
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await clickAndWaitForOperationResult<T>(page, triggerSelector, predicate);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === options.retries || !options.retryOnMessage.test(message)) {
        throw error;
      }
      await delay(options.delayMs ?? 5_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const waitForDidDocument = async (
  page: Page,
  predicate: (payload: any) => boolean,
): Promise<any> => {
  const deadline = Date.now() + 180_000;
  let lastPayload: any;

  while (Date.now() < deadline) {
    const response = await page.request.get(`${env.baseUrl}/api/did/document`);
    expect(response.ok()).toBe(true);
    lastPayload = await response.json();
    if (predicate(lastPayload)) return lastPayload;
    await delay(2_000);
  }

  throw new Error(`Timed out waiting for DID document.\nLast payload:\n${JSON.stringify(lastPayload, null, 2)}`);
};

test.describe.serial('did-manager-service UI', () => {
  test.setTimeout(300_000);
  const standaloneProfileName = 'standalone-e2e';

  test.beforeAll(async () => {
    env = await startManagerE2EEnv();
  });

  test.afterAll(async () => {
    if (env !== undefined) {
      await env.stop();
    }
  });

  test('starts session, deploys, updates, resolves and deactivates a DID', async ({ page }) => {
    await page.goto(`${env.baseUrl}/wallet`);
    await expect(page.getByRole('link', { name: 'Wallet Setup' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#startSession')).toBeDisabled();
    await expect(page.locator('#closeSession')).toBeDisabled();
    await expect(page.locator('#profileSelect')).toBeEnabled();
    await expect(page.locator('#profileName')).toBeEnabled();
    await page.fill('#profileName', standaloneProfileName);
    const profileSelected = await clickAndWaitForJsonResponse<any>(page, '#selectProfile', (url, method) => {
      return method === 'POST' && url.pathname === '/api/profiles/select';
    });
    expect(profileSelected).toMatchObject({
      ok: true,
      data: {
        profileName: standaloneProfileName,
      },
    });
    await expect(page.locator('#seedMode option[value="reuse"]')).toBeDisabled();

    await page.selectOption('#seedMode', 'provided');
    await page.fill('#seed', env.fundedSeed);
    await expect(page.locator('#startSession')).toBeDisabled();
    const prepared = await clickAndWaitForOperationResult<any>(page, '#prepareFunding', (url, method) => {
      return method === 'POST' && url.pathname === '/api/session/prepare-funding';
    });
    expect(prepared).toMatchObject({
      profile: 'standalone',
    });
    expect(prepared.unshieldedAddress).toMatch(/^mn_/);
    await expect(page.locator('#fundingAddress')).not.toHaveValue('');
    await expect(page.locator('#startSession')).toBeEnabled();
    await page.fill('#passphrase', 'midnight-dev-passphrase');
    await page.locator('#remember').check();
    const unlocked = await clickAndWaitForOperationResult<any>(page, '#startSession', (url, method) => {
      return method === 'POST' && url.pathname === '/api/session/start';
    });
    expect(unlocked).toMatchObject({
      status: {
        unlocked: true,
        profile: 'standalone',
      },
    });
    await expect(page.locator('#startSession')).toBeDisabled();
    await expect(page.locator('#closeSession')).toBeEnabled();
    await expect(page.locator('#profileSelect')).toBeDisabled();
    await expect(page.locator('#profileName')).toBeDisabled();
    await expect(page.locator('#walletNightBalance')).not.toHaveText('Unavailable');
    await expect(page.locator('#walletDustBalance')).not.toHaveText('Unavailable');

    await page.goto(`${env.baseUrl}/did`);
    await expect(page.getByRole('link', { name: 'DID Management' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#tabDidDocument')).toHaveClass(/active/);
    await page.locator('#tabDidSummary').click();
    await expect(page.locator('#tabDidSummary')).toHaveClass(/active/);
    await page.locator('#tabDidDocument').click();
    await expect(page.locator('#tabDidDocument')).toHaveClass(/active/);

    await clickAndWaitForOperationResultWithRetry(page, '#deploy', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/deploy';
    }, {
      retries: 2,
      retryOnMessage: /Not enough Dust generated to pay the fee|could not balance dust/i,
      delayMs: 8_000,
    });

    const deployed = await waitForDidDocument(page, (payload) => {
      return payload?.ok === true && typeof payload?.data?.didDocument?.id === 'string';
    });
    const did = deployed.data.didDocument.id as string;
    expect(did).toMatch(/^did:midnight:undeployed:[0-9a-f]{64}$/);

    await page.goto(`${env.baseUrl}/secret-storage`);
    await expect(page.getByRole('link', { name: 'Secret Storage' })).toHaveAttribute('aria-current', 'page');

    await page.fill('#keyId', 'auth-main');
    await page.selectOption('#keyCrv', 'Ed25519');
    const keyGeneration = await clickAndWaitForOperationResult<any>(page, '#keyGenerate', (url, method) => {
      return method === 'POST' && url.pathname === '/api/keys/generate';
    });
    expect(keyGeneration).toMatchObject({
      publicJwk: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
    });

    const keyRef = keyGeneration.keyRef as string;
    expect(keyRef.length).toBeGreaterThan(10);

    await page.goto(`${env.baseUrl}/did`);
    await expect(page.getByRole('link', { name: 'DID Management' })).toHaveAttribute('aria-current', 'page');

    await page.fill('#vmMethodId', '#auth-main');
    await page.fill('#vmKeyRef', keyRef);
    await clickAndWaitForOperationResult(page, '#vmAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/verification-methods';
    });

    const withVerificationMethod = await waitForDidDocument(page, (payload) => {
      const methods = payload?.data?.didDocument?.verificationMethod;
      return Array.isArray(methods) && methods.some((method: { id?: string }) => matchesReference(method.id, '#auth-main'));
    });
    expect(withVerificationMethod.data.didDocument.verificationMethod).toHaveLength(1);

    await page.fill('#relMethodId', '#auth-main');
    await page.selectOption('#vmRelation', 'Authentication');
    await clickAndWaitForOperationResult(page, '#relAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/relations';
    });

    const withRelation = await waitForDidDocument(page, (payload) => {
      const authentication = payload?.data?.didDocument?.authentication;
      return Array.isArray(authentication) && authentication.some((value: string) => matchesReference(value, '#auth-main'));
    });
    expect(withRelation.data.didDocument.authentication.some((value: string) => matchesReference(value, '#auth-main'))).toBe(true);

    await page.goto(`${env.baseUrl}/signatures`);
    await expect(page.getByRole('link', { name: 'Sign & Verify' })).toHaveAttribute('aria-current', 'page');
    await page.fill('#signKeyRef', keyRef);
    await page.selectOption('#signPayloadType', 'string');
    await page.fill('#signPayload', 'hello midnight');
    const signedPayload = await clickAndWaitForJsonResponse<any>(page, '#signPayloadButton', (url, method) => {
      return method === 'POST' && url.pathname === '/api/signatures/sign';
    });
    expect(signedPayload).toMatchObject({
      ok: true,
      data: {
        keyRef,
        payloadType: 'string',
      },
    });
    expect(String(signedPayload.data.verificationMethodId)).toContain('#auth-main');
    await page.locator('#copySignToVerify').click();
    await expect(page.locator('#verifyVerificationMethodId')).toHaveValue(String(signedPayload.data.verificationMethodId));
    const verifiedPayload = await clickAndWaitForJsonResponse<any>(page, '#verifyPayloadButton', (url, method) => {
      return method === 'POST' && url.pathname === '/api/signatures/verify';
    });
    expect(verifiedPayload).toMatchObject({
      ok: true,
      data: {
        verified: true,
        source: 'didDocument',
      },
    });
    expect(verifiedPayload.data.canonicalText).toBe('hello midnight');

    await page.selectOption('#signPayloadType', 'json');
    await page.fill('#signPayload', '{"z":1,"a":2}');
    const signedJsonPayload = await clickAndWaitForJsonResponse<any>(page, '#signPayloadButton', (url, method) => {
      return method === 'POST' && url.pathname === '/api/signatures/sign';
    });
    expect(signedJsonPayload).toMatchObject({
      ok: true,
      data: {
        payloadType: 'json',
        canonicalText: '{"a":2,"z":1}',
      },
    });

    await page.selectOption('#verifySource', 'publicJwk');
    await page.fill('#verifyPublicJwk', JSON.stringify(signedJsonPayload.data.publicJwk, null, 2));
    await page.selectOption('#verifyPayloadType', 'json');
    await page.fill('#verifyPayload', '{"a":2,"z":1}');
    await page.fill('#verifySignatureBase64Url', String(signedJsonPayload.data.signatureBase64Url));
    const verifiedJsonPayload = await clickAndWaitForJsonResponse<any>(page, '#verifyPayloadButton', (url, method) => {
      return method === 'POST' && url.pathname === '/api/signatures/verify';
    });
    expect(verifiedJsonPayload).toMatchObject({
      ok: true,
      data: {
        verified: true,
        source: 'publicJwk',
        payloadType: 'json',
        canonicalText: '{"a":2,"z":1}',
      },
    });

    await page.selectOption('#signPayloadType', 'bytes');
    await page.fill('#signPayload', '68656c6c6f');
    const signedBytesPayload = await clickAndWaitForJsonResponse<any>(page, '#signPayloadButton', (url, method) => {
      return method === 'POST' && url.pathname === '/api/signatures/sign';
    });
    expect(signedBytesPayload).toMatchObject({
      ok: true,
      data: {
        payloadType: 'bytes',
        canonicalHex: '68656c6c6f',
      },
    });

    await page.selectOption('#verifySource', 'localKey');
    await page.fill('#verifyKeyRef', keyRef);
    await page.selectOption('#verifyPayloadType', 'bytes');
    await page.fill('#verifyPayload', '68656c6c6f');
    await page.fill('#verifySignatureBase64Url', String(signedBytesPayload.data.signatureBase64Url));
    const verifiedBytesPayload = await clickAndWaitForJsonResponse<any>(page, '#verifyPayloadButton', (url, method) => {
      return method === 'POST' && url.pathname === '/api/signatures/verify';
    });
    expect(verifiedBytesPayload).toMatchObject({
      ok: true,
      data: {
        verified: true,
        source: 'localKey',
        payloadType: 'bytes',
        canonicalHex: '68656c6c6f',
      },
    });

    await page.goto(`${env.baseUrl}/did`);
    await expect(page.getByRole('link', { name: 'DID Management' })).toHaveAttribute('aria-current', 'page');

    await page.fill('#svcId', '#profile');
    await page.fill('#svcType', 'LinkedDomains');
    await page.fill('#svcEndpoint', '"https://example.com/profile"');
    await clickAndWaitForOperationResult(page, '#svcAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/services';
    });

    const withService = await waitForDidDocument(page, (payload) => {
      const services = payload?.data?.didDocument?.service;
      return Array.isArray(services) && services.some((service: { id?: string }) => matchesReference(service.id, '#profile'));
    });
    expect(withService.data.didDocument.service[0].serviceEndpoint).toBe('https://example.com/profile');

    await page.fill('#akaValue', 'https://example.org/profile/alice');
    await clickAndWaitForOperationResult(page, '#akaAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/also-known-as';
    });

    const withAlias = await waitForDidDocument(page, (payload) => {
      const aliases = payload?.data?.didDocument?.alsoKnownAs;
      return Array.isArray(aliases) && aliases.includes('https://example.org/profile/alice');
    });
    expect(withAlias.data.didDocument.alsoKnownAs).toContain('https://example.org/profile/alice');

    await clickAndWaitForOperationResult(page, '#deactivate', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/deactivate';
    });

    const deactivated = await waitForDidDocument(page, (payload) => {
      return payload?.data?.didDocumentMetadata?.deactivated === true;
    });
    expect(deactivated.data.didDocumentMetadata.deactivated).toBe(true);

    await page.goto(`${env.baseUrl}/wallet`);
    await expect(page.locator('#closeSession')).toBeEnabled();
    await clickAndWaitForJsonResponse<any>(page, '#closeSession', (url, method) => {
      return method === 'POST' && url.pathname === '/api/session/close';
    });
    await expect(page.locator('#startSession')).toBeEnabled();
    await expect(page.locator('#closeSession')).toBeDisabled();
    await expect(page.locator('#profileSelect')).toBeEnabled();
    await expect(page.locator('#profileName')).toBeEnabled();
  });
});
