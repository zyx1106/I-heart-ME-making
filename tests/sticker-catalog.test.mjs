import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const catalog = fs.readFileSync(path.join(root, 'sticker-catalog.js'), 'utf8');
const { assets, categories } = vm.runInNewContext(catalog + '\n;({ assets: STICKER_ASSETS, categories: STICKER_CATEGORIES })');
assert.deepEqual(Object.keys(assets), ['推荐', 'Y2K', '韩系', 'ins风', '像素风']);
const folders = { '推荐': '推荐', Y2K: 'y2k', '韩系': '韩系', 'ins风': 'ins', '像素风': '像素风' };
const packedApp = fs.readFileSync(path.join(root, 'minitool-dist/app.js'), 'utf8');
const inlineMatch = packedApp.match(/^var MINITOOL_STICKER_IMAGES = ([^\n]+);\n/);
const bundled = inlineMatch ? JSON.parse(inlineMatch[1]) : {};
const excluded = new Set(['049-S07-JPEG眼睛文件.png', '011-S01-蓝色动漫眼睛左.png', '012-S01-蓝色动漫眼睛右.png', '058-S08-时尚杂志拼贴.png']);
for (const [category, files] of Object.entries(assets)) {
  const originals = fs.readdirSync(path.join(root, '素材包/图片素材/贴纸素材', folders[category])).filter(name => name.endsWith('.png') && !excluded.has(name));
  assert.equal(files.length, originals.length, category + ': include every supplied file');
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(new Set(files.map(file => path.basename(file).replace(/\.webp$/, '.png'))), new Set(originals));
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.ok(fs.existsSync(path.join(root, 'minitool-dist', file)) || bundled[file], file);
  }
}
assert.ok(assets.Y2K.slice(0, 4).every(file => file.includes('胡子')));
assert.ok(assets.Y2K.slice(-3).every(file => file.includes('娃娃眼睛')));
const firstFlower = assets['推荐'].findIndex(file => /花|莲|百合|兰/.test(path.basename(file)));
assert.ok(firstFlower > 0);
assert.ok(assets['推荐'].slice(firstFlower).every(file => /花|莲|百合|兰/.test(path.basename(file))));
const html = fs.readFileSync(path.join(root, 'figma-doing-interactive.html'), 'utf8');
const from = html.indexOf('    function renderStickerPanel()');
const to = html.indexOf('    function addSticker(', from);
const element = () => ({ style: {}, dataset: {}, children: [], classList: { add() {} }, appendChild(child) { this.children.push(child); }, setAttribute() {} });
const frame = element();
const context = { STICKER_ASSETS: assets, STICKER_CATEGORIES: categories, state: { stickerCategory: 'Y2K' }, frame,
  document: { createElement: element }, imageInput: element, rect: element };
vm.createContext(context);
vm.runInContext(html.slice(from, to), context);
context.renderStickerPanel();
const grid = frame.children.find(child => child.className === 'abs sticker-scroll').children[0];
assert.equal(grid.children.length, assets.Y2K.length + 1);
assert.equal(grid.children[4].style.gridColumnStart, undefined, 'All four colored mustaches fit beside import on the first row');
assert.ok(grid.children.every(tile => !tile.style.gridColumnStart && !tile.style.gridRowStart), 'Every family must flow directly into the next without reserved cells');
assert.match(html, /\.sticker-grid > \.tile \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center;/);
assert.match(html, /\.sticker-img \{[^}]*object-fit: contain;[^}]*object-position: center;/);
console.log('PASS: catalog exclusions, continuous rows, dolls and recommended flowers last, local resource paths and centered contain layout');
