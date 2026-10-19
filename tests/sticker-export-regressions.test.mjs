import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../figma-doing-interactive.html', import.meta.url), 'utf8');
const source = name => {
  const start = html.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, name);
  return html.slice(start, html.indexOf('\n    function ', start + 1));
};
const metrics = { x: 55, y: 100, w: 280, h: 280 };
const sticker = { id: 1, gx: 0, gy: 0, baseW: 58, baseH: 58, scale: 0.02, rotation: 0, flipX: true, src: 'test.webp' };
const context = {
  state: { ratio: '1:1', stickers: [sticker], activeStickerId: 1, nextStickerId: 2 },
  FIGMA: { canvasRect: metrics }, history: { past: [], future: [] },
  snapshotState: () => JSON.stringify(context.state), render() {}, updateStickerElement() {}
};
vm.createContext(context);
for (const name of ['clamp', 'stickerAnchor', 'stickerPosition', 'stickerHandlePositions', 'duplicateSticker', 'bindStickerCanvasGestures']) {
  vm.runInContext(source(name), context);
}
const position = context.stickerPosition(sticker, metrics);
const handles = context.stickerHandlePositions(sticker, metrics);
assert.equal(Object.keys(handles).length, 4);
for (const point of Object.values(handles)) {
  assert.ok(Math.hypot(point.x - position.x, point.y - position.y) < 35, 'Tiny stickers must keep all controls nearby');
}
assert.ok(handles.copy.x < handles.rotate.x && handles.copy.y < handles.flip.y);
const copy = context.duplicateSticker(sticker, metrics);
assert.notEqual(copy.id, sticker.id);
assert.equal(copy.flipX, true);
assert.equal(copy.scale, sticker.scale);
assert.equal(copy.rotation, sticker.rotation);
assert.ok(Math.abs((copy.gx - sticker.gx) * metrics.w - 16) < 1e-8);
assert.ok(Math.abs((copy.gy - sticker.gy) * metrics.w - 16) < 1e-8);
assert.equal(context.state.activeStickerId, copy.id);
assert.equal(sticker.gx, 0, 'Copy must not move its source');

const scene = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390 }), setPointerCapture() {} };
context.bindStickerCanvasGestures(scene, metrics);
const blank = { closest: () => null };
const hit = { closest: selector => selector === '[data-sticker-id]' ? { dataset: { stickerId: '1' } } : null };
const event = (id, x, y, target = blank, type = '') => ({ pointerId: id, clientX: x, clientY: y, target, type, preventDefault() {} });
copy.scale = 1;
scene.onpointerdown(event(1, 100, 320));
scene.onpointerdown(event(2, 150, 320));
scene.onpointermove(event(2, 200, 320));
assert.equal(copy.scale, 2, 'A pinch starting outside the selected sticker must scale it');
scene.onpointerup(event(2, 200, 320));
scene.onpointerup(event(1, 100, 320));
assert.equal(context.state.activeStickerId, copy.id, 'Pinch must preserve selection');
assert.equal(context.history.past.length, 1, 'One pinch is one undo entry');
scene.onpointerdown(event(3, 100, 320));
scene.onpointerup(event(3, 100, 320));
assert.equal(context.state.activeStickerId, null, 'Blank tap deselects');
scene.onpointerdown(event(4, 195, 180, hit));
scene.onpointerup(event(4, 195, 180, hit));
assert.equal(context.state.activeStickerId, 1, 'Tapping a sticker selects it again');
const originalX = sticker.gx;
scene.onpointerdown(event(5, 195, 180, hit));
scene.onpointermove(event(5, 223, 194, hit));
scene.onpointerup(event(5, 223, 194, hit));
assert.ok(Math.abs(sticker.gx - originalX - 0.1) < 1e-8);
assert.equal(context.history.past.length, 2);
scene.onpointerdown(event(6, 10, 10));
scene.onpointerup(event(6, 10, 10));
assert.equal(context.state.activeStickerId, 1, 'Outside-canvas interactions must not change selection');

const contexts = [];
function drawingContext() {
  const result = {
    glyphs: [], scale() {}, fillRect() {}, save() {}, restore() {}, drawImage() {},
    measureText(text) { return { width: text === 'M' ? 20 : text === 'E' ? 12 : text === 'ME' ? 25 : 10 }; },
    fillText(text, x, y) { this.glyphs.push({ text, x, y }); }
  };
  contexts.push(result);
  return result;
}
const layout = { i: { x: 100, y: 150, fs: 50 }, me: { x: 170, y: 230, fs: 40, spacing: 3 }, symbol: { x: 180, y: 150, w: 70, h: 70 } };
const exported = {
  document: { createElement: () => ({ getContext: drawingContext }) },
  state: { text: 'ME', textColor: '#000000', textOpacity: 100, texture: false, showBg: false, canvasTexture: false, symbol: 'heart', symbolColor: '#ff0000', symbolOpacity: 100, symbolTexture: false, stickers: [] },
  canvasMetrics: () => metrics, artworkLayout: () => layout,
  SYMBOL_MASKS: { heart: '<svg/>' }, setTimeout, clearTimeout,
  Image: class { constructor() { this.width = this.height = 100; } set src(value) { queueMicrotask(() => this.onload()); } }
};
vm.createContext(exported);
vm.runInContext(fs.readFileSync(new URL('../minitool-export.js', import.meta.url), 'utf8'), exported);
await exported.exportNativeDesignCanvas();
const glyphs = contexts[2].glyphs;
assert.equal(glyphs[0].text, 'M');
assert.equal(glyphs[0].x, (280 - 20 - 12 - 3) / 2, 'Center the same per-character advances that are actually drawn');
assert.equal(glyphs[1].x, glyphs[0].x + 20 + 3);
assert.equal((glyphs[0].x + glyphs[1].x + 12) / 2, 140, 'Exported text must remain centered despite kerning differences');
assert.match(html, /font-kerning: none/);
assert.match(html, /prepareMiniToolImage\(\)\.then\(data =>/);
assert.match(html, /image\.src = data/);
console.log('PASS: nearby four-corner controls, offset copy, canvas-wide pinch, deselect/reselect, drag, and centered export advances');
