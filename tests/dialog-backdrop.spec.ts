import { test, expect } from '@playwright/test';
import { openLogoutConfirmation } from './helpers/navigation';

test('点击退出遮罩只取消确认，手机菜单保持打开', async ({ page }, info) => {
  await page.goto('/anutrium/about');
  await openLogoutConfirmation(page);
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('heading').click();
  await expect(dialog).toBeVisible();
  if (info.project.name === 'desktop') await page.mouse.click(2, 2);
  else await page.touchscreen.tap(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/anutrium\/about$/);
  if (info.project.name !== 'desktop') await expect(page.locator('#mobile-navigation')).toBeVisible();
});

test('管理弹窗点击内部或从内部拖出不关闭，点击遮罩关闭并保留草稿', async ({ page, isMobile }) => {
  // 全部笔记接口为夹具；任何意外写入直接使测试失败，不触碰真实存储。
  await page.route('**/api/notes**', route => {
    expect(route.request().method()).toBe('GET');
    return route.fulfill({ json: { notes: [], nextCursor: null } });
  });
  await page.goto('/anutrium/notes');
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建笔记', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('标题', { exact: true }).fill('遮罩关闭后保留的草稿');
  const heading = dialog.getByRole('heading', { name: '新建笔记', exact: true }).first();
  await heading.click();
  await expect(dialog).toBeVisible();
  const bounds = await heading.boundingBox();
  await page.mouse.move(bounds!.x + 10, bounds!.y + 10);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  if (isMobile) await page.touchscreen.tap(2, 2);
  else await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '继续编辑草稿', exact: true }).click();
  await expect(dialog.getByLabel('标题', { exact: true })).toHaveValue('遮罩关闭后保留的草稿');
});
