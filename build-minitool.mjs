import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const out = 'minitool-dist';
fs.mkdirSync(out, { recursive: true });
let html = fs.readFileSync('figma-doing-interactive.html', 'utf8');
let js = fs.readFileSync('sticker-catalog.js', 'utf8') + '\n' + html.match(/<script>([\s\S]*?)<\/script>/)[1];
html = html.replace(/  <script src="\.\/sticker-catalog\.js[^\"]*"><\/script>\n/, '');
html = html.replace(/<script>[\s\S]*?<\/script>/, '<script src="./app.js"></script>');
html = html.replace('./designer-color-picker.js?v=20261014-3', './designer-color-picker.js');
html = html.replace('素材包/英文字体-Corben/CooperBlackStd-3.otf', './assets/cooper.woff').replace('format("opentype")', 'format("woff")');
js = js.replace(/    async function exportDesignCanvas\(\)[\s\S]*?    function toast\(/, '    async function exportDesignCanvas() { return exportNativeDesignCanvas(); }\n    function toast(');
html = html.replace('./minitool-export.js?v=20261019-1', './minitool-export.js');
js = js.replace(/      save.onclick = async \(\) => \{[\s\S]*?      sheet.appendChild\(save\);/, '      save.onclick = () => deliverMiniToolImage("save");\n      sheet.appendChild(save);');
js = js.replace('note.onclick = () => toast("已复制小红书发布文案");', 'note.onclick = () => deliverMiniToolImage("post");');
js = js.replace(/const \{\s*active,\s*colorPicker,\s*modalOpen,\s*\.\.\.rest\s*\} = state;/, 'const rest = Object.assign({}, state); delete rest.active; delete rest.colorPicker; delete rest.modalOpen;');
js = js.replace('{ ...FIGMA.canvasRect, x: metrics.x, y: metrics.y, w: metrics.w, h: metrics.h }', 'Object.assign({}, FIGMA.canvasRect, { x: metrics.x, y: metrics.y, w: metrics.w, h: metrics.h })');
js = js.replace('{ ...layout.symbol, id: FIGMA.wordGroup.heart.id }', 'Object.assign({}, layout.symbol, { id: FIGMA.wordGroup.heart.id })');
js = js.replace('cell?.import', 'cell && cell.import');
js = js.replace('textureLayer(target)?.size || "auto"', '(textureLayer(target) || {}).size || "auto"').replace('textureLayer(target)?.image || "none"', '(textureLayer(target) || {}).image || "none"');
js = js.replace('measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight', '(measured.actualBoundingBoxLeft || 0) + (measured.actualBoundingBoxRight || 0)');
js = js.replace('conic-gradient(#ff1687,#fff84b,#5bd8b9,#67d8e9,#b586ee,#ff1687)', 'linear-gradient(90deg,#ff1687,#fff84b,#5bd8b9,#67d8e9,#b586ee)');
js = js.replace('document.fonts.ready.then(() => { render(); fit(); });', 'if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); fit(); });');
html = html.replace('gap: 8px 10px;', 'grid-gap: 8px 10px;');
html = html.replace(/      gap: (6|9|10|16|18)px;\n/g, '');
html = html.replace('</style>', `.round > * + * { margin-left: 6px; }
    .modal-action > * + * { margin-left: 18px; }
    .modal-action.note > * + * { margin-left: 16px; }
    .upload-row > * + * { margin-left: 9px; }
    .popover-actions > * + * { margin-left: 10px; }
    body { padding-top: 0; padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); padding-bottom: 0; padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); }
    .sticker-scroll { -webkit-overflow-scrolling: touch; }
    </style>`);
const assets = [];
const catalog = /const (\w+_STICKERS) = \[([\s\S]*?)\]\.map\(name => stickerPath\("([^"]+)", name\)\);/g;
for (const match of js.matchAll(catalog)) {
  for (const file of match[2].matchAll(/"([^"]+\.png)"/g)) assets.push({ folder: match[3], name: file[1] });
}
js = js.replace('`素材包/图片素材/贴纸素材/${folder}/${name}`', '`./assets/stickers/${folder}/${name}`');
js = js.replace('素材包/图片素材/贴纸素材/y2k/083-S09-粉色豹纹星星.png', './assets/stickers/y2k/083-S09-粉色豹纹星星.webp');
new vm.Script(js);
js = js.replace(/\.png(?=["'`])/g, '.webp');
html = html.replace('width: min(100vw, 390px);', 'width: 100vw; max-width: 390px;');
html = html.replace('width: min(350px, calc(100vw - 28px));', 'width: calc(100vw - 28px); max-width: 350px;');
html = html.replace('width: min(100vw - 16px, 374px);', 'width: calc(100vw - 16px); max-width: 374px;');
html = html.replace('height: min(84vh, 710px);', 'height: 84vh; max-height: 710px;');
html = html.replace(/inset: 0;/g, 'top: 0; right: 0; bottom: 0; left: 0;');
html = html.replace('backdrop-filter: blur(15px);', '');
html = html.replace('</style>', '@supports ((-webkit-backdrop-filter: blur(15px)) or (backdrop-filter: blur(15px))) { .modal { -webkit-backdrop-filter: blur(15px); backdrop-filter: blur(15px); } }\n</style>');
html = html.replace(/place-items: start center;/g, 'align-items: start; justify-items: center;').replace(/place-items: end center;/g, 'align-items: end; justify-items: center;').replace(/place-items: center;/g, 'align-items: center; justify-items: center;');
js = js.replace('event.currentTarget.setPointerCapture(event.pointerId);', 'if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'app.js'), js);
fs.copyFileSync('designer-color-picker.js', path.join(out, 'designer-color-picker.js'));
fs.copyFileSync('minitool-export.js', path.join(out, 'minitool-export.js'));
fs.mkdirSync(path.join(out, 'assets/sticker-controls'), { recursive: true });
for (const name of ['rotate', 'scale', 'flip']) fs.copyFileSync('assets/sticker-controls/' + name + '.svg', path.join(out, 'assets/sticker-controls', name + '.svg'));
fs.writeFileSync('/tmp/minitool-assets.json', JSON.stringify(assets));
console.log('Prepared', assets.length, 'referenced stickers');
