import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  workers: 3,
  webServer: {
    command: "npx vite --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    trace: "retain-on-failure",
  },
})
