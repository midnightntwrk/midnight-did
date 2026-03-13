import { setTimeout as delay } from 'node:timers/promises';

import { expect, type Page,test } from '@playwright/test';

import { type ManagerE2EEnv,startManagerE2EEnv } from './test-env.js';

let env: ManagerE2EEnv;

const matchesReference = (value: string | undefined, suffix: string): boolean =>
  typeof value === 'string' && (value === suffix || value.endsWith(suffix));

const readJson = async (page: Page, selector: string): Promise<unknown> => {
  const text = await page.locator(selector).textContent();
  if (text === null || text.trim() === '') {
    throw new Error(`No JSON content in ${selector}`);
  }
  return JSON.parse(text);
};

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

const refreshDid = async (page: Page): Promise<void> => {
  await page.locator('#refreshDid').click();
};

const waitForDidDocument = async (
  page: Page,
  predicate: (payload: any) => boolean,
): Promise<any> => {
  const deadline = Date.now() + 180_000;
  let lastPayload: any;

  while (Date.now() < deadline) {
    await refreshDid(page);
    lastPayload = await readJson(page, '#didDocument');
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

  test('unlocks, deploys, updates, resolves and deactivates a DID', async ({ page }) => {
    await page.goto(`${env.baseUrl}/wallet`);
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

    await page.selectOption('#seedMode', 'provided');
    await page.fill('#seed', env.fundedSeed);
    await page.fill('#passphrase', 'midnight-dev-passphrase');
    await page.selectOption('#remember', 'true');
    const unlocked = await clickAndWaitForJsonResponse<any>(page, '#unlock', (url, method) => {
      return method === 'POST' && url.pathname === '/api/session/unlock';
    });
    expect(unlocked).toMatchObject({
      ok: true,
      data: {
        status: {
          unlocked: true,
          profile: 'standalone',
        },
      },
    });

    await page.goto(`${env.baseUrl}/did`);

    await clickAndWaitForJsonResponse(page, '#deploy', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/deploy';
    });

    const deployed = await waitForDidDocument(page, (payload) => {
      return payload?.ok === true && typeof payload?.data?.didDocument?.id === 'string';
    });
    const did = deployed.data.didDocument.id as string;
    expect(did).toMatch(/^did:midnight:undeployed:[0-9a-f]{64}$/);

    await page.fill('#keyId', 'auth-main');
    await page.selectOption('#keyCrv', 'Ed25519');
    const keyGeneration = await clickAndWaitForJsonResponse<any>(page, '#keyGenerate', (url, method) => {
      return method === 'POST' && url.pathname === '/api/keys/generate';
    });
    expect(keyGeneration).toMatchObject({
      ok: true,
      data: {
        publicJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      },
    });

    const keyRef = keyGeneration.data.keyRef as string;
    expect(keyRef.length).toBeGreaterThan(10);

    await page.fill('#vmMethodId', '#auth-main');
    await page.fill('#vmKeyRef', keyRef);
    await clickAndWaitForJsonResponse(page, '#vmAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/verification-methods';
    });

    const withVerificationMethod = await waitForDidDocument(page, (payload) => {
      const methods = payload?.data?.didDocument?.verificationMethod;
      return Array.isArray(methods) && methods.some((method: { id?: string }) => matchesReference(method.id, '#auth-main'));
    });
    expect(withVerificationMethod.data.didDocument.verificationMethod).toHaveLength(1);

    await page.fill('#relMethodId', '#auth-main');
    await page.selectOption('#vmRelation', 'Authentication');
    await clickAndWaitForJsonResponse(page, '#relAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/relations';
    });

    const withRelation = await waitForDidDocument(page, (payload) => {
      const authentication = payload?.data?.didDocument?.authentication;
      return Array.isArray(authentication) && authentication.some((value: string) => matchesReference(value, '#auth-main'));
    });
    expect(withRelation.data.didDocument.authentication.some((value: string) => matchesReference(value, '#auth-main'))).toBe(true);

    await page.fill('#svcId', '#profile');
    await page.fill('#svcType', 'LinkedDomains');
    await page.fill('#svcEndpoint', '"https://example.com/profile"');
    await clickAndWaitForJsonResponse(page, '#svcAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/services';
    });

    const withService = await waitForDidDocument(page, (payload) => {
      const services = payload?.data?.didDocument?.service;
      return Array.isArray(services) && services.some((service: { id?: string }) => matchesReference(service.id, '#profile'));
    });
    expect(withService.data.didDocument.service[0].serviceEndpoint).toBe('https://example.com/profile');

    await page.fill('#akaValue', 'https://example.org/profile/alice');
    await clickAndWaitForJsonResponse(page, '#akaAdd', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/also-known-as';
    });

    const withAlias = await waitForDidDocument(page, (payload) => {
      const aliases = payload?.data?.didDocument?.alsoKnownAs;
      return Array.isArray(aliases) && aliases.includes('https://example.org/profile/alice');
    });
    expect(withAlias.data.didDocument.alsoKnownAs).toContain('https://example.org/profile/alice');

    await clickAndWaitForJsonResponse(page, '#deactivate', (url, method) => {
      return method === 'POST' && url.pathname === '/api/did/deactivate';
    });

    const deactivated = await waitForDidDocument(page, (payload) => {
      return payload?.data?.didDocumentMetadata?.deactivated === true;
    });
    expect(deactivated.data.didDocumentMetadata.deactivated).toBe(true);
  });
});
