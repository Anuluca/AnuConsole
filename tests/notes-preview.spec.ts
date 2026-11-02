import { test, expect, type Page } from '@playwright/test';
import { openNavigation } from './helpers/navigation';

const id = '5d357fe2-81f2-434b-a990-a51efa4a1f91';
const body = `正文与**加粗文字**，以及*斜体文字*。\n\n脚注示例[^first]。\n\n> 引用内容\n\n## 二级标题\n\n\`\`\`js\n// 示例注释\nconst message = "${'long-code-'.repeat(40)}";\nconsole.log(message);\n\`\`\`\n\n![图片测试](https://assets.anuluca.com/Island/notes/markdown-it-demo/minion.png)\n\n[^first]: Footnote **can have markup**\n\n    第二个脚注段落。`;
const source = `---\ntitle: "脚注渲染演示"\ndate: "2026-11-01"\ncategory: test\n---\n\n${body}\n`;
const note = { id, title: '脚注渲染演示', time: '2026-11-01', type: 'test', etag: '"v1"', path: `/atrium/notes?category=test&note=${id}` };
async function mock(page: Page, consoleApp: boolean) {
  await page.route(consoleApp ? '**/api/notes**' : 'https://steam-api.anuluca.com/notes**', route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405 });
    return new URL(route.request().url()).pathname.endsWith(id)
      ? route.fulfill({ contentType: 'text/markdown', headers: { 'X-Note-Version': '"v1"' }, body: source })
      : route.fulfill({ json: { notes: [note], nextCursor: null } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
async function fontReady(page: Page) {
  await page.locator('.footnotes strong').waitFor();
  await page.evaluate(async () => {
    await document.fonts.load('600 18px AnutriumNoteSans', '正文与 Footnote');
    await document.fonts.load('900 18px AnutriumNoteSans', '加粗文字 can have markup');
  });
}
async function metrics(page: Page, dialog: string) {
  return page.locator(dialog).evaluate(element => {
    const reader = element.querySelector('.note-reader')!;
    const strong = reader.querySelector('.footnotes strong')!;
    const code = reader.querySelector('pre code')!;
    const box = element.getBoundingClientRect();
    const footer = element.querySelector('.infra-modal-footer, .diamond-close-btn')!.getBoundingClientRect();
    return { gapTop: footer.top - box.bottom, gapBottom: innerHeight - footer.bottom, width: box.width, height: box.height, top: box.top, left: box.left, padding: getComputedStyle(reader).padding, lineHeight: getComputedStyle(reader).lineHeight, weight: getComputedStyle(reader.querySelector('.note-markdown')!).fontWeight, strong: getComputedStyle(strong).fontWeight, font: getComputedStyle(strong).fontFamily, code: getComputedStyle(code).fontFamily, content: reader.querySelector('.note-markdown')!.innerHTML };
  });
}

test('两端脚注、字重、代码行号、预览尺寸及图片交互一致，刷新与路由进入后仍生效', async ({ page, context, browserName }, info) => {
  test.setTimeout(150000);
  await mock(page, true);
  await page.goto('/anutrium/notes', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.notes-editor')).toHaveCount(0);
  await page.locator('.notes-row').getByRole('button', { name: '查看', exact: true }).click();
  await fontReady(page);
  const website = await context.newPage();
  await mock(website, false);
  await website.goto(`http://localhost:3000${note.path}`, { waitUntil: 'domcontentloaded' });
  await fontReady(website);
  await expect.poll(async () => { const box = await metrics(page, '.notes-viewer-modal'); return box.width / box.height; }).toBeCloseTo(info.project.name === 'desktop' ? 16 / 9 : 3 / 4, 2);
  const actual = await metrics(page, '.notes-viewer-modal');
  const expected = await metrics(website, '.note-detail-modal');
  expect(actual.width / actual.height).toBeCloseTo(info.project.name === 'desktop' ? 16 / 9 : 3 / 4, 2);
  for (const field of ['padding', 'lineHeight', 'font', 'code', 'content'] as const) expect(actual[field]).toBe(expected[field]);
  expect(actual.weight).toBe('600'); expect(actual.strong).toBe('900');
  expect(actual.lineHeight).toBe('28.5px');
  expect(actual.code).toBe('consolas, Menlo, monospace');
  expect(Math.abs(actual.gapTop - actual.gapBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(expected.gapTop - expected.gapBottom)).toBeLessThanOrEqual(1);
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await expect.poll(async () => (await metrics(page, '.notes-viewer-modal')).width).toBeGreaterThan(2000);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  if (browserName === 'chromium') {
    for (const target of [page, website]) {
      const session = await target.context().newCDPSession(target);
      await session.send('DOM.enable'); await session.send('CSS.enable');
      const { root } = await session.send('DOM.getDocument');
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.footnotes strong' });
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      expect(fonts.some(font => font.isCustomFont && /Heavy/i.test(font.postScriptName))).toBe(true);
      const paragraph = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.note-markdown > p' });
      const normal = await session.send('CSS.getPlatformFontsForNode', { nodeId: paragraph.nodeId });
      expect(normal.fonts.some(font => font.isCustomFont && /SemiBold/i.test(font.postScriptName))).toBe(true);
      await session.detach();
    }
  }
  for (const target of [page, website]) {
    const frame = target.locator('.note-code-frame').first();
    const gutter = frame.locator('.note-code-gutter');
    await expect(frame.locator('.hljs-comment')).toHaveCSS('color', 'rgb(179, 182, 189)');
    const left = (await gutter.boundingBox())!.x;
    await frame.locator('pre').evaluate(element => element.scrollLeft = 100);
    expect(await frame.locator('pre').evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    expect(Math.abs((await gutter.boundingBox())!.x - left)).toBeLessThanOrEqual(1);
    expect(await frame.evaluate(element => ['paddingTop','paddingBottom','paddingLeft','paddingRight'].map(key => getComputedStyle(element)[key as 'paddingTop']))).toEqual(['16px','16px','16px','16px']);
    await target.locator('.note-markdown img').click();
    await expect(target.locator(target === page ? '.notes-image-modal' : '.el-image-viewer__wrapper')).toBeVisible();
    await target.keyboard.press('Escape');
    await expect(target.locator(target === page ? '.notes-image-modal' : '.el-image-viewer__wrapper')).toHaveCount(0);
    await expect(target.locator(target === page ? '.notes-viewer-modal' : '.note-detail-modal')).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('notes-preview.png') });
  await page.getByRole('dialog', { name: note.title, exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  const editor = page.locator('.notes-editor-modal');
  const box = (await editor.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(info.project.name === 'desktop' ? 16 / 9 : 3 / 4, 2);
  expect(await editor.locator('.infra-modal-content h2').allTextContents()).not.toContain('新建笔记');
  await expect(editor.locator('.notes-preview-heading')).toHaveText('预览');
  const radioLayout = await editor.locator('.notes-categories label').evaluateAll(labels => labels.map(label => ({
    text: label.textContent, width: label.getBoundingClientRect().width, height: label.getBoundingClientRect().height,
    radio: (label.querySelector('input')!).getBoundingClientRect().width,
    nowrap: getComputedStyle(label).whiteSpace,
  })));
  expect(radioLayout).toHaveLength(4);
  for (const label of radioLayout) { expect(label.nowrap).toBe('nowrap'); expect(label.radio).toBe(16); expect(label.height).toBeLessThan(35); }
  const importLayout = await editor.locator('.notes-import').evaluate(label => {
    const text = label.querySelector('span')!.getBoundingClientRect(), input = label.querySelector('input')!.getBoundingClientRect();
    return Math.abs(text.top + text.height / 2 - input.top - input.height / 2);
  });
  expect(importLayout).toBeLessThanOrEqual(1);
  const geometry = await editor.evaluate(element => {
    const content = element.querySelector('.infra-modal-content')!, textarea = element.querySelector('textarea')!, preview = element.querySelector('.notes-preview')!, grid = element.querySelector('.notes-editor-grid')!;
    return { content: content.getBoundingClientRect().toJSON(), textarea: textarea.getBoundingClientRect().toJSON(), preview: preview.getBoundingClientRect().toJSON(), grid: grid.getBoundingClientRect().toJSON(), overflow: getComputedStyle(content).overflowY, scroll: content.scrollTop };
  });
  expect(Math.abs(geometry.textarea.height - geometry.preview.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.textarea.y - geometry.preview.y)).toBeLessThanOrEqual(1);
  expect(geometry.overflow).toBe('hidden'); expect(geometry.scroll).toBe(0);
  expect(geometry.grid.height).toBeGreaterThan(90);
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(2000);
    expect((await editor.locator('textarea').boundingBox())!.height).toBeGreaterThan(500);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  for (const field of [page.getByLabel('标题', { exact: true }), page.getByLabel('Markdown 正文', { exact: true })]) {
    await field.click();
    expect(await field.evaluate(element => getComputedStyle(element).outlineOffset)).toBe('-2px');
    expect(await field.evaluate(element => getComputedStyle(element).borderLeftColor)).toBe('rgb(226, 52, 86)');
  }
  await editor.screenshot({ path: info.outputPath('notes-editor.png') });
  await page.getByLabel('标题', { exact: true }).fill(note.title);
  await page.getByLabel('Markdown 正文', { exact: true }).fill(body);
  expect(await page.locator('.notes-preview .note-markdown').innerHTML()).toBe(actual.content);
  await expect(page.locator('.notes-editor-modal > .infra-modal-footer').getByRole('button', { name: '发布笔记', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: '新建笔记', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.notes-row').getByRole('button', { name: '查看', exact: true }).click();
  await fontReady(page);
  expect((await metrics(page, '.notes-viewer-modal')).width).toBe(actual.width);
  await page.getByRole('dialog', { name: note.title, exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await (await openNavigation(page)).getByRole('link', { name: '关于', exact: true }).click();
  await expect(page).toHaveURL('/anutrium/about');
  await (await openNavigation(page)).getByRole('link', { name: '笔记管理', exact: true }).click();
  await expect(page).toHaveURL('/anutrium/notes');
  await expect(page.locator('.notes-row')).toHaveCount(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.notes-row').getByRole('button', { name: '查看', exact: true }).click();
  await fontReady(page);
  expect((await metrics(page, '.notes-viewer-modal')).padding).toBe(actual.padding);
  await website.close();
});

test('引用来源保留正文大小与强调格式，缩写使用电视机入场退场', async ({ page }) => {
  await mock(page, true);
  await page.route(`**/api/notes/${id}`, route => route.fulfill({ contentType: 'text/markdown', headers: { 'X-Note-Version': '"v1"' }, body: `${source}\n\n{% blockquote 大卫·利维坦，《清醒》 %}\n引用正文。\n{% endblockquote %}\n\n<acronym title="美国职业篮球联赛">NBA</acronym>\n\n| 标题 |\n| --- |\n| 内容 |` }));
  await page.goto('/anutrium/notes', { waitUntil: 'domcontentloaded' });
  await page.locator('.notes-row').getByRole('button', { name: '查看', exact: true }).click();
  const reader = page.locator('.notes-viewer-modal .note-reader');
  await expect(reader.locator('.note-quote footer')).toHaveCSS('font-size', '20px');
  await expect(reader.locator('.note-quote footer strong')).toHaveCSS('font-weight', '900');
  await expect(reader.locator('.note-quote footer cite')).toHaveCSS('font-style', 'italic');
  await expect(reader.locator('td')).toHaveCSS('padding', '12px 18px');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const abbreviation = reader.locator('acronym');
  await abbreviation.hover();
  await expect(abbreviation).toHaveClass(/is-tooltip-open/);
  expect(await abbreviation.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('anutriumCrtOn');
  await abbreviation.evaluate(element => {
    element.addEventListener('animationstart', event => {
      const animation = event as AnimationEvent;
      if (animation.animationName === 'anutriumCrtOff') element.setAttribute('data-test-exit-animation', animation.animationName);
    });
  });
  await reader.locator('.note-quote').hover();
  await expect(abbreviation).toHaveAttribute('data-test-exit-animation', 'anutriumCrtOff');
  await expect(abbreviation).not.toHaveClass(/is-tooltip-closing/);
});

test('查看弹窗播放标题居中入场，编辑预览不重复播放', async ({ page }) => {
  await mock(page, true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/anutrium/notes', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    (window as any).noteEntranceStages = [];
    const observer = new MutationObserver(() => {
      const reader = document.querySelector<HTMLElement>('.notes-viewer-modal .note-reader');
      const stage = reader?.dataset.noteEnter;
      if (stage && !(window as any).noteEntranceStages.includes(stage)) (window as any).noteEntranceStages.push(stage);
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-note-enter'], childList: true });
  });
  await page.locator('.notes-row').getByRole('button', { name: '查看', exact: true }).click();
  const reader = page.locator('.notes-viewer-modal .note-reader');
  await expect(reader).toHaveAttribute('data-note-enter', 'ready', { timeout: 15000 });
  const stages = await page.evaluate(() => (window as any).noteEntranceStages);
  expect(stages).toEqual(expect.arrayContaining(['title', 'meta', 'hold', 'moving', 'ready']));
  await expect(reader.locator('.note-markdown p').first()).toBeVisible();
  await page.getByRole('dialog', { name: note.title, exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await expect(page.locator('.notes-preview .note-reader')).not.toHaveAttribute('data-note-enter');
});
