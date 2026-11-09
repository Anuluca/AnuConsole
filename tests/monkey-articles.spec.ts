import { expect, test } from '@playwright/test';
import { openNavigation } from './helpers/navigation';
const id = '8200000000000-00000000-0000-4000-8000-000000000001';
const article = { id, title: 'Zyxw abcd', createdAt: '2026-11-09T00:00:00Z', words: 180, characters: 1000, preview: 'Zyxw abcd qrst.', content: 'Zyxw abcd qrst. '.repeat(100) };
test('archives can be read and deleted through protected management APIs without changing real storage', async ({page}) => {
  let deleted = false;
  await page.route('**/api/monkey-articles**', route => {
    if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['if-match']).toBe('"version-1"');
      deleted = true;
      return route.fulfill({json:{ok:true}});
    }
    return route.fulfill({json: route.request().url().endsWith(`/${id}`) ? article : {articles: deleted ? [] : [article],nextCursor:null},headers:{ETag:'"version-1"'}});
  });
  await page.goto('/anutrium/monkey-typewriter');
  await expect(page.getByRole('heading',{name:'巴别图书馆'})).toBeVisible();
  await page.getByRole('button',{name:'查看全文'}).click();
  await expect(page.locator('.monkey-fulltext')).toContainText('Zyxw abcd qrst.');
  await page.getByRole('button',{name:'删除文章',exact:true}).click();
  await expect(page.getByRole('button',{name:'确认删除'})).toBeVisible();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByRole('button',{name:'确认删除'})).toHaveCount(0);
  expect(deleted).toBe(false);
  await page.getByRole('button',{name:'删除文章',exact:true}).click();
  await page.getByRole('button',{name:'确认删除'}).click();
  await expect(page.getByText('暂无文章。')).toBeVisible();
  expect(deleted).toBe(true);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});


test('档案列表直达、完整刷新及路由切换后刷新保持布局', async ({ page }) => {
  await page.route('**/api/monkey-articles**', route => route.fulfill({ json: { articles: [article], nextCursor: null } }));
  const snapshot = async () => {
    await expect(page.getByRole('button', { name: '查看全文' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return page.locator('.monkey-record').evaluate(element => ({
      direction: getComputedStyle(element).flexDirection,
      gap: getComputedStyle(element).gap,
      font: getComputedStyle(element).fontSize,
      overflow: document.documentElement.scrollWidth > innerWidth,
      buttonHeight: element.querySelector('button')!.getBoundingClientRect().height,
    }));
  };
  await page.goto('/anutrium/monkey-typewriter');
  const initial = await snapshot();
  expect(initial.overflow).toBe(false);
  await page.reload();
  expect(await snapshot()).toEqual(initial);
  await (await openNavigation(page)).getByRole('link', { name: '关于', exact: true }).click();
  await expect(page).toHaveURL('/anutrium/about');
  await (await openNavigation(page)).getByRole('link', { name: '猴子打字', exact: true }).click();
  expect(await snapshot()).toEqual(initial);
  await page.reload();
  expect(await snapshot()).toEqual(initial);
});
