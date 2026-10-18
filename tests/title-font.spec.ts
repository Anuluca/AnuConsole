import { test, expect } from "@playwright/test";

test("页面标题的中文实际使用线上 UnboundedSans 字体", async ({ page, context }) => {
  const session = await context.newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  for (const path of ["/anutrium", "/anutrium/monitor/ga4", "/anutrium/features", "/anutrium/data", "/anutrium/about", "/drrr", "/drrr/about"]) {
    await page.goto(path);
    const title = page.locator(".page-heading h1");
    await expect(title).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.load('900 36px "UnboundedSans"', document.querySelector(".page-heading h1")!.textContent!);
    });
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".page-heading h1" });
    // 检查浏览器实际绘制字形的字体，避免 CSS 已声明但中文仍回退的误判。
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font.isCustomFont).toBe(true);
      expect(font.familyName).toContain("Unbounded Sans");
    }
  }
});
