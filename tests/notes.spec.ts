import { test, expect, type Page } from '@playwright/test';
import { parseNoteDocument } from '../src/lib/note-document';

const firstId = '2aa08581-e032-4f35-9aa7-c84c19c57e98';
const secondId = '45c47661-d7b2-45b3-8a65-7a091c6ca4bf';
const source = (title: string, category = 'technology') => `---\ntitle: "${title}"\ndate: "2026-10-31"\ncategory: ${category}\n---\n\n## 正文\n\n<script>window.noteInjected = true</script>\n\n\`\`\`ts\nconst count = 1\n\`\`\``;
async function mockNotes(page: Page) {
  const records = new Map([[firstId, { source: source('Vue 组件笔记'), etag: '"v1"' }], [secondId, { source: source('阅读记录', 'daily'), etag: '"v1"' }]]);
  const state = { writes: [] as { method: string; id: string; etag?: string }[], conflict: false };
  await page.route('**/api/infrastructure/connections', route => route.fulfill({ json: { cloudflare: false, netlify: false } }));
  await page.route('**/api/notes**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.pathname.split('/')[3];
    const record = records.get(id);
    if (request.method() === 'GET') {
      if (!id) return route.fulfill({ json: { notes: [...records.entries()].map(([id, record]) => ({ id, ...parseNoteDocument(record.source).metadata, etag: record.etag, path: `/atrium/notes?note=${id}` })), nextCursor: null } });
      return route.fulfill(record ? { contentType: 'text/markdown', headers: { ETag: `W/${record.etag}`, 'X-Note-Version': record.etag }, body: record.source } : { status: 404, json: { error: '未找到笔记。' } });
    }
    const etag = request.headers()['if-match'];
    state.writes.push({ method: request.method(), id, etag });
    if (state.conflict || (request.method() !== 'PUT' && etag !== record?.etag)) return route.fulfill({ status: 412, json: { error: '笔记已被其他窗口修改，当前编辑已保留。' } });
    if (request.method() === 'DELETE') { records.delete(id); return route.fulfill({ json: { id, deleted: true } }); }
    const nextTag = '"v2"';
    records.set(id, { source: request.postData()!, etag: nextTag });
    return route.fulfill({ status: request.method() === 'PUT' ? 201 : 200, headers: { ETag: `W/${nextTag}`, 'X-Note-Version': nextTag }, json: { id, etag: nextTag } });
  });
  return { records, state };
}

test.beforeEach(async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === 'production', '生产身份验证由认证回归覆盖');
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('标题搜索、分类筛选、正文查看与原文均从服务器读取', async ({ page }, info) => {
  await mockNotes(page);
  await page.goto('/anutrium/notes');
  await expect(page.locator('.notes-row')).toHaveCount(2);
  await expect(page.locator('.notes-categories input')).toHaveCount(3);
  await expect(page.locator('.notes-categories')).toHaveText('技术宝可梦日常');
  await page.getByLabel('搜索标题').fill('Vue');
  await expect(page.locator('.notes-row')).toHaveCount(1);
  await page.locator('.notes-row').getByRole('button', { name: '查看', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Vue 组件笔记');
  await expect(dialog.locator('.notes-viewer pre')).toContainText('const count = 1');
  await expect(dialog.locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => 'noteInjected' in window)).toBe(false);
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(false);
  await dialog.getByText('Markdown 原文', { exact: true }).click();
  await expect(dialog.locator('.notes-source pre')).toContainText('category: technology');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('搜索标题').fill('');
  await page.getByRole('button', { name: '筛选笔记标签' }).click();
  await page.getByRole('option', { name: '日常', exact: true }).click();
  await expect(page.locator('.notes-row')).toHaveCount(1);
  await expect(page.locator('.notes-row')).toContainText('阅读记录');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('notes-management.png'), fullPage: true });
});

test('编辑草稿刷新后保留原文章和版本，保存更新原文件而非新增', async ({ page }) => {
  const { records, state } = await mockNotes(page);
  await page.goto('/anutrium/notes');
  await page.locator('.notes-row').filter({ hasText: 'Vue 组件笔记' }).getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('Vue 组件笔记');
  await page.getByLabel('标题', { exact: true }).fill('Vue 更新后的笔记');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('anuconsole.notes.draft.v1') || '{}').editing?.id)).toBe(firstId);
  await page.reload();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('Vue 更新后的笔记');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByText('修改已保存，前台刷新后可见。')).toBeVisible();
  await expect(page.locator('.notes-row')).toHaveCount(2);
  await expect(page.locator('.notes-row').filter({ hasText: 'Vue 更新后的笔记' })).toHaveCount(1);
  expect(state.writes).toEqual([{ method: 'PATCH', id: firstId, etag: '"v1"' }]);
  expect(records.get(firstId)?.source).toContain('Vue 更新后的笔记');
  await expect(page.getByRole('button', { name: '保存修改', exact: true })).toBeDisabled();
});

test('版本冲突保留编辑，重新载入先确认未保存的修改', async ({ page }) => {
  const { state, records } = await mockNotes(page);
  await page.goto('/anutrium/notes');
  await page.locator('.notes-row').first().getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('本地未保存内容');
  state.conflict = true;
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('.notes-manager > [role=alert]')).toContainText('当前编辑已保留');
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('本地未保存内容');
  records.set(firstId, { source: source('服务器最新内容'), etag: '"v3"' });
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '保留编辑' }).click();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('本地未保存内容');
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '放弃并继续' }).click();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('服务器最新内容');
});

test('删除需确认，取消和 Escape 不写入，确认后列表移除且弹窗不改变布局', async ({ page }) => {
  const { state, records } = await mockNotes(page);
  await page.goto('/anutrium/notes');
  const row = page.locator('.notes-row').filter({ hasText: 'Vue 组件笔记' });
  const button = row.getByRole('button', { name: '删除', exact: true });
  await button.scrollIntoViewIfNeeded();
  const before = await page.locator('.route-scroll').evaluate(el => ({ top: el.scrollTop, width: document.body.clientWidth }));
  await button.click();
  let dialog = page.getByRole('dialog', { name: '删除笔记' });
  await expect(dialog).toBeVisible();
  const during = await page.locator('.route-scroll').evaluate(el => ({ top: el.scrollTop, width: document.body.clientWidth }));
  expect(Math.abs(during.top - before.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(during.width - before.width)).toBeLessThanOrEqual(1);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await button.click(); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); expect(state.writes).toHaveLength(0);
  await button.click(); dialog = page.getByRole('dialog', { name: '删除笔记' });
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.notes-row')).toHaveCount(1);
  expect(records.has(firstId)).toBe(false);
  expect(state.writes).toEqual([{ method: 'DELETE', id: firstId, etag: '"v1"' }]);
});

test('删除版本冲突时保留文章并允许关闭确认框', async ({ page }) => {
  const { state } = await mockNotes(page); state.conflict = true;
  await page.goto('/anutrium/notes');
  await page.locator('.notes-row').first().getByRole('button', { name: '删除', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '删除笔记' });
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('其他窗口修改');
  await expect(page.locator('.notes-row')).toHaveCount(2);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('导入 Markdown 后新增笔记仍走独立创建接口', async ({ page }) => {
  const { records, state } = await mockNotes(page);
  await page.goto('/anutrium/notes');
  await page.getByLabel('导入 Markdown 文件').setInputFiles({ name: 'imported.md', mimeType: 'text/markdown', buffer: Buffer.from(source('导入的新笔记')) });
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('导入的新笔记');
  await page.getByRole('radio', { name: '宝可梦', exact: true }).check();
  await page.getByRole('button', { name: '发布笔记', exact: true }).click();
  await expect(page.locator('.notes-row')).toHaveCount(3);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].method).toBe('PUT');
  expect(state.writes[0].etag).toBeUndefined();
  expect(records.get(state.writes[0].id)?.source).toContain('导入的新笔记');
  expect(records.get(state.writes[0].id)?.source).toContain('category: pokemon');
});
