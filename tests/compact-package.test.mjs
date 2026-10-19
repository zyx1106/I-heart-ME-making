import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'minitool-dist');
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? files(file) : [file];
});
assert.ok(files(dist).length <= 200);
const app = fs.readFileSync(path.join(dist, 'app.js'), 'utf8');
const data = JSON.parse(app.match(/^var MINITOOL_STICKER_IMAGES = ([^\n]+);\n/)[1]);
const catalogEnd = app.indexOf('\n    const FIGMA');
assert.ok(catalogEnd > 0);
const packed = vm.runInNewContext(app.slice(0, catalogEnd) + '\n;STICKER_ASSETS');
const source = vm.runInNewContext(fs.readFileSync(path.join(root, 'sticker-catalog.js'), 'utf8') + '\n;STICKER_ASSETS');
for (const category of Object.keys(source)) {
  assert.equal(packed[category].length, source[category].length);
  for (let i = 0; i < source[category].length; i++) {
    const file = source[category][i];
    const expected = fs.readFileSync(path.join(root, file));
    const actual = data[file] ? Buffer.from(packed[category][i].split(',')[1], 'base64') : fs.readFileSync(path.join(dist, packed[category][i]));
    assert.deepEqual(actual, expected, 'Preserve exact bytes and order: ' + file);
  }
}
for (const uri of Object.values(data)) assert.ok(Buffer.from(uri.split(',')[1], 'base64').length < 100 * 1024);
assert.ok(Buffer.byteLength(app) < 2 * 1024 * 1024);
assert.ok(!files(dist).some(file => /node_modules|\.git|\.DS_Store|\.map$/.test(file)));
console.log('PASS: <=200 files, exact sticker bytes/category order, bounded small image data, no development files');
