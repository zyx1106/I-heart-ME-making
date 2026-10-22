import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../figma-doing-interactive.html', import.meta.url), 'utf8');
const functionSource = name => {
  const start = html.indexOf(`    function ${name}(`);
  const asyncStart = html.indexOf(`    async function ${name}(`);
  const from = start >= 0 ? start : asyncStart;
  assert.ok(from >= 0, name);
  const end = html.indexOf('\n    function ', from + 1);
  const asyncEnd = html.indexOf('\n    async function ', from + 1);
  return html.slice(from, Math.min(...[end, asyncEnd].filter(i => i >= 0)));
};
const context = {
  state: { text: 'HELLO', textSize: 100, textSpacing: 0, ratio: '1:1' },
  FIGMA: { canvasRect: { x: 55, y: 100, w: 280, h: 280 } },
  document: { createElement: () => ({ getContext: () => ({ font: '', measureText(text) {
    // Legacy WebViews expose width without actualBoundingBox fields.
    return { width: text.length * Number(this.font.match(/([\d.]+)px/)[1]) * 0.65 };
  } }) }) }
};
vm.createContext(context);
for (const name of ['canvasMetrics', 'artworkLayout', 'stickerAnchor']) vm.runInContext(functionSource(name), context);
for (const text of ['ME', 'WWWWWWW', 'WWWWWWWW', 'WWWWWWWWWW', 'ABCDEFGHIJ', 'Happy2026!', 'hello', '独居青年']) {
  for (const size of [50, 100, 180]) {
    context.state.text = text; context.state.textSize = size; context.state.textSpacing = 0;
    context.state.ratio = '1:1';
    const original = context.artworkLayout(context.canvasMetrics());
    context.state.textSpacing = 40;
    const spaced = context.artworkLayout(context.canvasMetrics());
    assert.equal(original.me.fs, spaced.me.fs, 'Spacing must not resize glyphs');
    for (const ratio of ['3:4', '9:16']) {
      context.state.ratio = ratio;
      const metrics = context.canvasMetrics();
      const layout = context.artworkLayout(metrics);
      const scale = metrics.w / 280;
      assert.ok(Number.isFinite(layout.me.fs), 'Legacy metrics must remain finite');
      assert.ok(Math.abs(layout.me.fs / spaced.me.fs - scale) < 1e-10);
      assert.ok(Math.abs(layout.i.fs / spaced.i.fs - scale) < 1e-10);
      assert.ok(Math.abs((layout.me.y - layout.i.y) / (spaced.me.y - spaced.i.y) - scale) < 1e-10);
      assert.ok(layout.me.x >= metrics.x && layout.me.x + layout.me.w - layout.me.spacing <= metrics.x + metrics.w);
      assert.ok(Math.abs(layout.me.x + (layout.me.w - layout.me.spacing) / 2 - metrics.x - metrics.w / 2) < 1e-8, 'Center long names and all spacing values');
      assert.ok(layout.me.y > layout.symbol.y + layout.symbol.h, 'Keep a visible vertical gap');
    }
  }
}

let payload;
let image = 'data:image/png;base64,latest-design-1';
context.window = { xhs: { miniTool: { postNote: async value => { payload = value; } } } };
context.snapshotState = () => JSON.stringify(context.state);
vm.runInContext(fs.readFileSync(new URL('../minitool-export.js', import.meta.url), 'utf8'), context);
context.exportNativeDesignCanvas = async () => ({ toDataURL: () => image });
context.toast = () => {};
context.console = console;
vm.runInContext(functionSource('publishCurrentDesign'), context);
await context.publishCurrentDesign();
assert.equal(payload.title, '我的I❤️ME定制贴图');
assert.equal(payload.content, '用I❤️ME生成器一键生成的，快来试试吧😋\n#小工具#I❤️ME#生成器#diy');
assert.equal(payload.mediaInfo.image_resources[0].url, image);
image = 'data:image/png;base64,latest-design-2';
context.state.text = 'new';
await context.publishCurrentDesign();
assert.equal(payload.mediaInfo.image_resources[0].url, image, 'Publishing must regenerate the current design');
context.history = { past: [], future: [] };
context.snapshotState = () => JSON.stringify(context.state);
context.refreshTexturePreview = () => {};
context.render = () => {};
vm.runInContext(functionSource('bindPhotoGesture'), context);
for (const target of ['symbol', 'bg']) {
  const poseKey = target === 'symbol' ? 'symbolPhoto' : 'bgPhoto';
  context.state[poseKey] = { x: 0, y: 0, zoom: 1 };
  const scene = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390 }), setPointerCapture() {} };
  context.bindPhotoGesture(scene, { x: 55, y: 100, w: 280, h: 280 }, target);
  const event = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, preventDefault() {} });
  scene.onpointerdown(event(1, 300, 340)); // Blank canvas area, outside the symbol.
  scene.onpointermove(event(1, 320, 355));
  assert.equal(context.state[poseKey].x, 20);
  assert.equal(context.state[poseKey].y, 15);
  scene.onpointerdown(event(2, 270, 355));
  scene.onpointermove(event(2, 220, 355));
  assert.equal(context.state[poseKey].zoom, 2);
  scene.onpointerup(event(2, 220, 355));
  scene.onpointercancel(event(1, 320, 355));
  assert.ok(context.history.past.length > 0);
}
context.rect = () => ({ style: {} });
context.commitChange = change => change();
let clearButton;
context.frame = { appendChild: button => { clearButton = button; } };
vm.runInContext(functionSource('renderClearPhotoButton'), context);
for (const target of ['symbol', 'bg']) {
  context.state[target + 'Color'] = '#123456';
  context.state[target + 'Image'] = 'test-image';
  context.renderClearPhotoButton(target, 0, 0, 100);
  clearButton.onclick();
  assert.equal(context.state[target + 'Image'], '');
  assert.equal(context.state[target + 'Color'], '#123456');
  assert.equal(context.state[target + 'Photo'].zoom, 1);
}
for (const name of ['stickerPosition', 'clamp', 'stickerHandlePositions']) vm.runInContext(functionSource(name), context);
for (const ratio of ['1:1', '3:4', '9:16']) {
  context.state.ratio = ratio;
  const metrics = context.canvasMetrics();
  for (const scale of [0.02, 1, 5, 200]) {
    for (const rotation of [0, 45, 90, 180, 270]) {
      for (const offset of [-3, 0, 3]) {
        const handles = context.stickerHandlePositions({ gx: offset, gy: offset, baseW: 58, baseH: 58, scale, rotation }, metrics);
        for (const point of Object.values(handles)) {
          assert.ok(point.x >= metrics.x + 22 && point.x <= metrics.x + metrics.w - 22);
          assert.ok(point.y >= metrics.y + 22 && point.y <= metrics.y + metrics.h - 22);
        }
        const points = Object.values(handles);
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
          assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) >= 48 - 1e-8);
        }
      }
    }
  }
}
assert.ok(html.indexOf('      fit();\n      scroll.scrollTop = scrollTop;') > 0, 'Restore scroll only after fitting the editor viewport');
vm.runInContext(functionSource('cleanMainText'), context);
assert.equal(context.cleanMainText('Abc!?'), 'Abc!?');
assert.equal(context.cleanMainText('a中文12😀B!'), 'a12B!');
assert.equal(context.cleanMainText('I2026!?'), 'I2026!?');
assert.equal(context.cleanMainText('abcdefgh'), 'abcdefgh');
assert.equal(context.cleanMainText('abcdefghij'), 'abcdefghij');
assert.equal(context.cleanMainText('abcdefghijk'), 'abcdefghij');
assert.equal(context.cleanMainText('Happy2026!'), 'Happy2026!');
let field;
const messages = [];
context.document.createElement = () => ({ setAttribute() {} });
context.setPos = () => {};
context.txt = () => ({});
context.frame.appendChild = element => { if (element.className === 'abs field') field = element; };
context.renderTypographySlider = context.renderSwatches = context.renderTextureCard = context.renderArtworkOnly = () => {};
context.toast = message => messages.push(message);
context.state.text = 'ME';
vm.runInContext(functionSource('renderTextPanel'), context);
context.renderTextPanel();
assert.equal(field.value, 'ME');
field.oncompositionstart();
field.value = '中文';
field.oninput({ target: field, isComposing: true });
assert.equal(context.state.text, 'ME', 'Do not change the artwork during IME composition');
field.oncompositionend({ target: field });
assert.equal(field.value, '');
assert.equal(messages.pop(), '无法输入中文');
field.value = 'Hello!';
field.oninput({ target: field });
assert.equal(context.state.text, 'Hello!');
field.oncompositionstart();
field.value = 'Cortis';
field.oninput({ target: field, isComposing: true, inputType: 'insertCompositionText' });
assert.equal(context.state.text, 'Cortis', 'Latin text must preview even when a Chinese IME marks it composing');
assert.equal(field.value, 'Cortis', 'Never rewrite the IME buffer during composition');
field.oncompositionend({ target: field, isComposing: true });
assert.equal(context.state.text, 'Cortis', 'Composition-end must commit even with a stale isComposing flag');
field.oncompositionstart();
field.value = 'Hi?!';
field.oninput({ target: field, isComposing: true, inputType: 'insertFromComposition' });
assert.equal(context.state.text, 'Hi?!', 'A commit input must work without compositionend');
field.oncompositionstart();
field.value = '中文';
field.oncompositionend({ target: field, isComposing: true });
assert.equal(messages.pop(), '无法输入中文');
assert.equal(context.state.text, '');
field.oncompositionstart();
field.value = 'English';
field.oninput({ target: field, isComposing: true });
field.onblur({ target: field, isComposing: true });
assert.equal(context.state.text, 'English', 'Blur must finalize an IME session with no end event');
field.value = 'Abcdefghijkl';
field.oninput({ target: field, isComposing: false });
assert.equal(context.state.text, 'Abcdefghij', 'Apply the ten-character limit after composition, not via native maxlength');
assert.equal(messages.pop(), '最多输入10个字符');
field.oncompositionstart();
field.value = 'ABCDEFGHIJ';
field.oninput({ target: field, isComposing: true });
assert.equal(context.state.text, 'ABCDEFGHIJ', 'Chinese IMEs must still preview ten Latin characters');
field.oncompositionend({ target: field });
assert.equal(context.state.text, 'ABCDEFGHIJ');
console.log('PASS: editor contracts, photo gestures, publishing, scroll restoration and bounded non-overlapping sticker handles');
