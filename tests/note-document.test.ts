import assert from 'node:assert/strict';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';
import { NOTE_CATEGORY_OPTIONS } from '../src/lib/note-categories.ts';
import { parseNoteDocument } from '../src/lib/note-document.ts';

const source = '---\ntitle: "Vue: 组件笔记"\ndate: "2026-10-31"\ncategory: technology\n---\n\n## 示例\n\n```ts\nconst count = 1\n```';
test('Markdown 文件元信息支持中文、冒号与 Windows 换行，正文保留代码', () => {
  const result = parseNoteDocument('\uFEFF' + source.replace(/\n/g, '\r\n'));
  assert.deepEqual(result.metadata, { title: 'Vue: 组件笔记', time: '2026-10-31', type: 'technology' });
  assert.match(result.body, /const count = 1/);
});
test('拒绝错误日期、空正文、非法分类及本地封面', () => {
  for (const text of [source.replace('2026-10-31', '2026-02-31'), source.replace('technology', 'invalid'), source.replace('category: technology', 'category: technology\ncover: /@fs/test.png'), source.replace(/## 示例[\s\S]*/, '')]) assert.throws(() => parseNoteDocument(text));
});
test('拒绝重复字段与未知字段，不将发布数据混入正文配置', () => {
  assert.throws(() => parseNoteDocument(source.replace('category: technology', 'category: technology\ncategory: daily')));
  assert.throws(() => parseNoteDocument(source.replace('category: technology', 'category: technology\nprivate: hidden')));
});
test('后台预览禁用 HTML 与脚本协议，同时保留代码块与表格', () => {
  const markdown = new MarkdownIt({ html: false, linkify: true });
  const html = markdown.render('<script>alert(1)</script>\n\n[点击](javascript:alert(1))\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```ts\nconst a = 1\n```');
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(html, /<table>/);
  assert.match(html, /<code class="language-ts">/);
});

test('四个标签统一由配置提供，技术、宝可梦、日常、测试均可写入 Markdown，前端标签不再可用', () => {
  assert.deepEqual(NOTE_CATEGORY_OPTIONS.map(option => option.label), ['技术', '宝可梦', '日常', '测试']);
  for (const option of NOTE_CATEGORY_OPTIONS) {
    assert.equal(parseNoteDocument(source.replace('category: technology', `category: ${option.value}`)).metadata.type, option.value);
  }
  assert.throws(() => parseNoteDocument(source.replace('category: technology', 'category: frontend')));
});
