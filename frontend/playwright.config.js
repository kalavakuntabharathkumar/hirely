import { defineConfig } from "@playwright/test";

// Start the backend (port 8000) and the frontend (port 5173) yourself, then run: npx playwright test
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 7000 },
  workers: 1, // one shared database, so tests run one at a time
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});