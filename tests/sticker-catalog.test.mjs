import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
const catalog = fs.readFileSync(path.join(root, 'sticker-catalog.js'), 'utf8');
const { assets, categories } = vm.runInNewContext(catalog + '\n;({ assets: STICKER_ASSETS, categories: STICKER_CATEGORIES })');
assert.deepEqual(Object.keys(assets), ['推荐', 'Y2K', '生日', '韩系', 'ins风', '像素风']);
assert.deepEqual(Array.from(categories), Object.keys(assets));
const folders = { '推荐': '推荐', Y2K: 'y2k', '生日': '生日', '韩系': '韩系', 'ins风': 'ins', '像素风': '像素风' };
const packedApp = fs.readFileSync(path.join(root, 'minitool-dist/app.js'), 'utf8');
const inlineMatch = packedApp.match(/^var MINITOOL_STICKER_IMAGES = ([^\n]+);\n/);
const bundled = inlineMatch ? JSON.parse(inlineMatch[1]) : {};
const excluded = new Set(['049-S07-JPEG眼睛文件.png', '011-S01-蓝色动漫眼睛左.png', '012-S01-蓝色动漫眼睛右.png', '058-S08-时尚杂志拼贴.png']);
for (const [category, files] of Object.entries(assets)) {
  const originals = fs.readdirSync(path.join(root, '素材包/图片素材/贴纸素材', folders[category])).filter(name => name.endsWith('.png') && !excluded.has(name));
  const optimized = fs.readdirSync(path.join(root, 'assets/stickers', folders[category]))
    .filter(name => name.endsWith('.webp')).map(name => name.replace(/\.webp$/, '.png')).filter(name => !excluded.has(name));
  const available = new Set([...originals, ...optimized]);
  assert.equal(files.length, available.size, category + ': include every supplied file and preserve published WebPs');
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(new Set(files.map(file => path.basename(file).replace(/\.webp$/, '.png'))), available);
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.ok(fs.existsSync(path.join(root, 'minitool-dist', file)) || bundled[file], file);
  }
}
assert.ok(assets.Y2K.slice(0, 4).every(file => file.includes('胡子')));
assert.ok(assets.Y2K.slice(-3).every(file => file.includes('娃娃眼睛')));
assert.deepEqual(Array.from(assets['推荐'].slice(0, 4), file => path.basename(file)), [
  '029-S01-草莓蛋糕爆炸框组合.webp', '016-S01-粉色星星生日帽.webp',
  '030-S01-彩色生日刺绣字贴.webp', '019-S01-生日彩带徽章.webp'
]);
assert.ok(assets['韩系'][0].endsWith('/029-S01-草莓蛋糕爆炸框组合.webp'));
assert.ok(assets['生日'][0].endsWith('/016-S01-粉色星星生日帽.webp'));
assert.ok(assets['生日'].slice(0, 5).every(file => /生日帽|派对帽/.test(file)), 'Birthday hats lead the birthday category');
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
const categoryBar = frame.children.find(child => child.className === 'abs segmented');
assert.equal(categoryBar.children.length, 6);
assert.deepEqual(categoryBar.children.map(button => button.textContent), Array.from(categories));
const viewport = { scrollLeft: 0, clientWidth: 350 };
context.revealStickerCategory(viewport, { offsetLeft: 348, offsetWidth: 69.2 });
assert.ok(Math.abs(viewport.scrollLeft - 67.2) < 1e-8, 'Reveal the sixth category without moving the entire page');
context.revealStickerCategory(viewport, { offsetLeft: 140, offsetWidth: 69.2 });
assert.ok(Math.abs(viewport.scrollLeft - 67.2) < 1e-8, 'Keep the category scroll position when the selected tab is already visible');
context.revealStickerCategory(viewport, { offsetLeft: 2, offsetWidth: 69.2 });
assert.equal(viewport.scrollLeft, 2, 'Reveal the first category again');
const grid = frame.children.find(child => child.className === 'abs sticker-scroll').children[0];
assert.equal(grid.children.length, assets.Y2K.length + 1);
assert.equal(grid.children[4].style.gridColumnStart, undefined, 'All four colored mustaches fit beside import on the first row');
assert.ok(grid.children.every(tile => !tile.style.gridColumnStart && !tile.style.gridRowStart), 'Every family must flow directly into the next without reserved cells');
assert.match(html, /\.sticker-grid > \.tile \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center;/);
assert.match(html, /\.sticker-img \{[^}]*object-fit: contain;[^}]*object-position: center;/);
assert.match(html, /\.segmented \{[^}]*grid-auto-flow: column;[^}]*grid-auto-columns: 20%;[^}]*overflow-x: auto;/);
assert.match(html, /categories\.scrollLeft = categoryScrollLeft;/);
console.log('PASS: six categories with five visible, scroll restoration, birthday hats first, four recommendations pinned, shared cake, continuous rows, preserved WebPs and centered contain layout');
