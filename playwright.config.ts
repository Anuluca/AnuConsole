import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // 复用开发服务时冷编译可能超过 5 秒；不将开发构建耗时当作导航功能失败。
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:3002", timezoneId: "Asia/Shanghai", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL, viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel: process.env.PLAYWRIGHT_CHANNEL } },
    // 刷新回归必须覆盖 Safari 内核，不能仅依赖 Chromium 的手机尺寸模拟。
    { name: "mobile-safari", testMatch: "**/responsive-reload.spec.ts", use: { ...devices["iPhone 13"], browserName: "webkit", defaultBrowserType: "webkit" } }
  ]
  // 默认用户已启动服务，测试配置不自动创建或关闭服务。
});
