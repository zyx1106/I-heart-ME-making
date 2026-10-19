import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = 'minitool-dist';
const listFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? listFiles(file) : [file];
});
const assets = JSON.parse(fs.readFileSync('/tmp/minitool-assets.json', 'utf8'));
const expected = new Set(assets.map(item => './assets/stickers/' + item.folder + '/' + item.name.replace(/\.png$/, '.webp')));
// Restore generated originals so repeated compaction starts from identical inputs.
for (const relative of expected) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(relative, destination);
}
const candidates = Array.from(expected).map(relative => ({ relative, data: fs.readFileSync(relative) }))
  .sort((a, b) => a.data.length - b.data.length || a.relative.localeCompare(b.relative));
const required = Math.max(0, listFiles(root).length - 190);
const selected = candidates.slice(0, required);
const images = {};
for (const item of selected) {
  if (item.data.length > 100 * 1024) throw new Error('Refuse to embed a large sticker: ' + item.relative);
  images[item.relative] = 'data:image/webp;base64,' + item.data.toString('base64');
}
const appPath = path.join(root, 'app.js');
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace(/^var MINITOOL_STICKER_IMAGES = [^\n]+;\n/, '');
const originalPath = 'const stickerPath = (folder, name) => `./assets/stickers/${folder}/${name.replace(/\\.png$/, ".webp")}`;';
const compactPath = 'const stickerPath = (folder, name) => { const src = `./assets/stickers/${folder}/${name.replace(/\\.png$/, ".webp")}`; return MINITOOL_STICKER_IMAGES[src] || src; };';
if (!app.includes(originalPath) && !app.includes(compactPath)) throw new Error('Sticker catalog signature changed');
app = app.replace(originalPath, compactPath);
app = app.replace(/activeStickerSrc: "(\.\/assets\/stickers\/[^"\n]+)"/, 'activeStickerSrc: MINITOOL_STICKER_IMAGES["$1"] || "$1"');
app = 'var MINITOOL_STICKER_IMAGES = ' + JSON.stringify(images) + ';\n' + app;
if (Buffer.byteLength(app) > 2 * 1024 * 1024) throw new Error('Compacted script exceeds 2 MiB budget');
new vm.Script(app);
fs.writeFileSync(appPath, app);
for (const item of selected) fs.unlinkSync(path.join(root, item.relative));
const count = listFiles(root).length;
if (count > 200) throw new Error('Package exceeds 200-file limit: ' + count);
console.log('PASS:', count, 'files;', selected.length, 'small stickers bundled; all', expected.size, 'stickers preserved');
