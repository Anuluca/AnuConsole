import { test, expect } from '@playwright/test';
import { openNavigation } from './helpers/navigation';

const id='a12ee06a-a95f-4cbc-9b65-ff71bbca5371';
const body='::::: tabs\n:::: tab BW\n::: gallery\n![BW 图片](https://assets.anuluca.com/Island/notes/pokemonCorocoro/BW/IMG_1763.jpg)\n:::\n::::\n:::: tab XY\n::: tool-card\n[工具](https://example.com/)\n\n工具说明\n:::\n::::\n:::::';
const source=`---\ntitle: "内容块测试"\ndate: "2026-11-02"\ncategory: pokemon\ncover: "https://assets.anuluca.com/Island/notes/pokemonCorocoro/BW2/IMG_2129.jpg"\n---\n\n${body}`;

test('后台分组可切换，图片使用缩略图与原图，插入入口生成 Markdown', async ({page})=>{
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/notes**',route=>new URL(route.request().url()).pathname.endsWith(id)?route.fulfill({contentType:'text/markdown',headers:{'X-Note-Version':'"v1"'},body:source}):route.fulfill({json:{notes:[{id,title:'内容块测试',time:'2026-11-02',type:'pokemon',etag:'"v1"'}],nextCursor:null}}));
  await page.route('https://assets.anuluca.com/Island/notes/pokemonCorocoro/**', route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"/>'}));
  await page.goto('/anutrium/notes');
  await page.locator('.notes-row').getByRole('button',{name:'查看',exact:true}).click();
  const preview=page.locator('.notes-viewer-modal');
  await expect(preview.locator('.note-reader__cover img')).toHaveCSS('object-fit', 'cover');
  await expect(preview.locator('.note-reader__cover img')).toHaveCSS('object-position', '50% 45%');
  await expect(preview.locator('.note-widget-gallery img')).toHaveAttribute('src',/image=card-thumb/);
  await preview.locator('.note-widget-gallery img').click();
  await expect(page.locator('.notes-image-modal img')).toHaveAttribute('src',/IMG_1763.jpg$/);
  await page.keyboard.press('Escape');
  await preview.getByRole('button',{name:'XY',exact:true}).click();
  await expect(preview.locator('.note-widget-tool-card')).toBeVisible();
  await expect(preview.locator('.note-widget-gallery')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'新建笔记',exact:true}).click();
  await page.getByLabel('封面路径（可选）').fill('Island/notes/pokemonCorocoro/BW2/IMG_2129.jpg');
  await expect(page.locator('.notes-preview .note-reader__cover img')).toHaveAttribute('src', /BW2\/IMG_2129.jpg\?image=card-thumb/);
  await page.locator('.notes-block-inserter summary').click();
  await page.getByLabel('图片路径与说明').fill('Island/notes/pokemonCorocoro/BW/IMG_1763.jpg | BW 图片');
  await page.getByRole('button',{name:'插入正文',exact:true}).click();
  await expect(page.getByLabel('Markdown 正文',{exact:true})).toHaveValue(/::: gallery\n!\[BW 图片\]/);
  await expect(page.locator('.notes-preview .note-widget-gallery img')).toHaveCount(1);
  await page.getByRole('button',{name:'分组标签页',exact:true}).click();
  await page.getByLabel('分组名称（每行一个）').fill('BW\nXY');
  await page.getByRole('button',{name:'插入正文',exact:true}).click();
  await expect(page.getByLabel('Markdown 正文',{exact:true})).toHaveValue(/::::: tabs/);
  await page.getByRole('button',{name:'工具卡',exact:true}).click();
  await page.getByLabel('工具名称',{exact:true}).fill('示例工具');
  await page.getByLabel('工具链接',{exact:true}).fill('https://example.com/');
  await page.getByLabel('工具说明',{exact:true}).fill('工具说明');
  await page.getByRole('button',{name:'插入正文',exact:true}).click();
  await expect(page.getByLabel('Markdown 正文',{exact:true})).toHaveValue(/::: tool-card/);
  await expect(page.locator('.notes-preview .note-widget-tool-card')).toBeVisible();
  async function closeEditor() {
    await page.locator('.notes-editor-modal').getByRole('button', {name:'关闭', exact:true}).click();
    await expect(page.locator('.notes-editor-modal')).toHaveCount(0);
  }
  async function checkPanelGeometry() {
    await page.getByRole('button',{name:'新建笔记',exact:true}).click();
    await page.locator('.notes-block-inserter summary').click();
    const bounds = await page.locator('.notes-block-inserter__panel').boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    await closeEditor();
  }
  await closeEditor();
  await page.reload();
  await checkPanelGeometry();
  await page.goto('/anutrium');
  const nav = await openNavigation(page);
  await nav.getByRole('link',{name:'笔记管理',exact:true}).click();
  await expect(page).toHaveURL(/\/anutrium\/notes$/);
  await page.getByRole('button',{name:'新建笔记',exact:true}).waitFor();
  await page.reload();
  await checkPanelGeometry();
});
