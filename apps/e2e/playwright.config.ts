import { defineConfig, devices } from "@playwright/test";

/**
 * Exercises the full stack (web + api + postgres + redis + minio + maildev)
 * against a running deployment — see docker-compose.yml. This config never
 * starts that stack itself (no `webServer`); the CI job (or a developer)
 * brings it up first with `docker compose up -d --build`.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  // AUTH_REGISTER is rate-limited to 5/hour per client (see
  // packages/config/src/constants.ts) and every spec here registers at
  // least one fresh user — retries would burn through that budget fast, so
  // failures should surface once rather than retry.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
