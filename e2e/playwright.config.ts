import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 47391);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  forbidOnly: process.env.CI !== undefined,
  reporter: process.env.CI === undefined ? "list" : "github",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The suite must run against the dev server. The Svelte invariants it guards, such as "Batch
    // has scheduled roots", exist only in DEV builds.
    command: `vite dev --port ${port} --strictPort`,
    cwd: import.meta.dirname,
    url: baseURL,
    reuseExistingServer: false,
  },
});
