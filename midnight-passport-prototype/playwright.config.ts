import { defineConfig } from "@playwright/test";

const host = "127.0.0.1";
const port = 5194;
const baseURL =
  process.env.PASSPORT_PROTOTYPE_BASE_URL ?? `http://${host}:${port}`;
const hasExternalServer = Boolean(process.env.PASSPORT_PROTOTYPE_BASE_URL);

export default defineConfig({
  testDir: "./src/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: hasExternalServer
    ? undefined
    : {
        command: `HOST=${host} PORT=${port} npm run app:serve`,
        url: `${baseURL}/api/state`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
