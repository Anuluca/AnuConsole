import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { isThemeMode, timeTheme, nextThemeBoundary, THEME_INIT_SCRIPT } from "../src/lib/theme.ts";

test("自动主题在本地时间 07:00 和 19:00 切换", () => {
  assert.equal(timeTheme(new Date(2026, 9, 17, 6, 59, 59)), "dark");
  assert.equal(timeTheme(new Date(2026, 9, 17, 7)), "light");
  assert.equal(timeTheme(new Date(2026, 9, 17, 18, 59, 59)), "light");
  assert.equal(timeTheme(new Date(2026, 9, 17, 19)), "dark");
  assert.equal(nextThemeBoundary(new Date(2026, 9, 17, 6, 59, 59)), 1000);
  assert.equal(nextThemeBoundary(new Date(2026, 9, 17, 18, 59, 59)), 1000);
  assert.equal(nextThemeBoundary(new Date(2026, 9, 17, 23)), 8 * 60 * 60 * 1000);
});

test("首屏脚本读取有效偏好，禁用存储时仍能显示自动主题", () => {
  for (const preference of ["light", "dark", "auto", "invalid"]) {
    const dataset: Record<string, string> = {};
    runInNewContext(THEME_INIT_SCRIPT, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: () => preference }
    });
    assert.equal(dataset.themeMode, isThemeMode(preference) ? preference : "auto");
    assert.equal(dataset.theme, preference === "light" || preference === "dark" ? preference : timeTheme());
  }
  const dataset: Record<string, string> = {};
  runInNewContext(THEME_INIT_SCRIPT, {
    document: { documentElement: { dataset } },
    localStorage: { getItem: () => { throw new Error("storage disabled"); } }
  });
  assert.equal(dataset.themeMode, "auto");
  assert.equal(dataset.theme, timeTheme());
});
