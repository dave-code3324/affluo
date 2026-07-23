import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      ...process.env,
      DETECTION_ENABLED: demoPasswordEnabled() ? "true" : "false",
      DETECTION_SOURCE_BODACC_DEMO_ENABLED: demoPasswordEnabled()
        ? "true"
        : "false",
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});

function demoPasswordEnabled() {
  return Boolean(process.env.E2E_DEMO_USER_PASSWORD);
}
