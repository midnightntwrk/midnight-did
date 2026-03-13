import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { type ManagerE2EEnv,startManagerPreprodFundingEnv } from './test-env.js';

let env: ManagerE2EEnv;
let dataDir: string;

const clickAndWaitForJsonResponse = async <T>(
  page: import('@playwright/test').Page,
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

test.describe.serial('did-manager-service preprod funding', () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    if (env !== undefined) {
      await env.stop();
    }
    if (dataDir !== undefined) {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  test('prepares and persists a reusable preprod seed/address pair', async ({ page }) => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), 'did-manager-preprod-funding-'));
    env = await startManagerPreprodFundingEnv(dataDir);

    await page.goto(`${env.baseUrl}/wallet`);
    await page.selectOption('#seedMode', 'generated');
    const prepared = await clickAndWaitForJsonResponse<any>(page, '#prepareFunding', (url, method) => {
      return method === 'POST' && url.pathname === '/api/session/prepare-funding';
    });
    expect(prepared.ok).toBe(true);
    expect(prepared.data.profile).toBe('preprod');
    expect(prepared.data.generatedSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(prepared.data.unshieldedAddress.length).toBeGreaterThan(10);
    expect(prepared.data.faucetUrl).toBe('https://faucet.preprod.midnight.network/');

    const generatedSeed = prepared.data.generatedSeed as string;
    const preparedAddress = prepared.data.unshieldedAddress as string;

    await expect(page.locator('#seed')).toHaveValue(generatedSeed);
    await expect(page.locator('#seedMode')).toHaveValue('provided');
    await expect(page.locator('#fundingAddress')).toHaveValue(preparedAddress);
    await expect(page.locator('#faucetUrl')).toHaveValue('https://faucet.preprod.midnight.network/');

    await env.stop();
    env = await startManagerPreprodFundingEnv(dataDir);

    await page.goto(`${env.baseUrl}/wallet`);
    const status = await clickAndWaitForJsonResponse<any>(page, '#status', (url, method) => {
      return method === 'GET' && url.pathname === '/api/session';
    });
    expect(status.ok).toBe(true);
    expect(status.data.profile).toBe('preprod');
    expect(status.data.seedAvailable).toBe(true);
    expect(status.data.unshieldedAddress).toBe(preparedAddress);

    await page.selectOption('#seedMode', 'reuse');
    const reused = await clickAndWaitForJsonResponse<any>(page, '#prepareFunding', (url, method) => {
      return method === 'POST' && url.pathname === '/api/session/prepare-funding';
    });
    expect(reused.ok).toBe(true);
    expect(reused.data.generatedSeed).toBeUndefined();
    expect(reused.data.unshieldedAddress).toBe(preparedAddress);
  });
});
