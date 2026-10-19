import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Element {
  constructor() {
    this.children = [];
    this.style = { setProperty() {} };
    this.dataset = {};
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: name => this.classes.delete(name),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
    };
  }
  set innerHTML(value) { this.children = []; }
  appendChild(child) { this.children.push(child); child.parentNode = this; }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; }
  setAttribute() {}
  contains(target) { return this.children.some(child => child === target || child.contains(target)); }
  querySelectorAll() { return []; }
}
const root = new Element();
const pixelCalls = [];
let strokes = 0;
const pixels = { data: [18, 52, 86, 255] };
const canvasContext = {
  beginPath() {}, arc() {}, stroke() { strokes++; },
  getImageData(x, y) { pixelCalls.push({ x, y }); return pixels; }
};
const context = {
  document: {
    createElement: tag => tag === 'canvas' ? { getContext: () => canvasContext, toDataURL: () => 'data:image/png;base64,cmluZw==' } : new Element(),
    getElementById: () => root
  },
  hslToHex: () => '#abcdef'
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../designer-color-picker.js', import.meta.url), 'utf8'), context);
assert.equal(context.designerColorRingBackground(), 'url("data:image/png;base64,cmluZw==")');
context.designerColorRingBackground();
assert.equal(strokes, 360, 'Generate and cache one offline raster ring');

const canvas = { width: 1080, height: 1440, getContext: () => canvasContext };
const bounds = { left: 20, top: 100, width: 270, height: 360 };
assert.equal(context.canvasSampleColor(canvas, bounds, 155, 280), '#123456');
assert.equal(pixelCalls.at(-1).x, 540);
assert.equal(pixelCalls.at(-1).y, 720);
context.canvasSampleColor(canvas, bounds, 290, 460);
assert.equal(pixelCalls.at(-1).x, 1079);
assert.equal(pixelCalls.at(-1).y, 1439);
assert.equal(context.canvasSampleColor(canvas, bounds, 19, 280), null);
assert.equal(context.canvasSampleColor(canvas, { ...bounds, width: 0 }, 20, 100), null);
pixels.data = [0, 0, 0, 0];
assert.equal(context.canvasSampleColor(canvas, bounds, 155, 280), '#ffffff');

const html = fs.readFileSync(new URL('../figma-doing-interactive.html', import.meta.url), 'utf8');
const start = html.indexOf('    function renderColorPicker()');
const end = html.indexOf('\n    function ', start + 1);
context.state = { colorPicker: 'text', textColor: '#ff0000', textOpacity: 100 };
context.history = { past: [], future: [] };
context.snapshotState = () => JSON.stringify({ textColor: context.state.textColor, textOpacity: context.state.textOpacity });
context.pickerBefore = context.snapshotState();
context.restoreSnapshot = snapshot => Object.assign(context.state, JSON.parse(snapshot));
context.colorForMode = () => context.state.textColor;
context.setColorForMode = (_, color) => { context.state.textColor = color; };
context.refreshTexturePreview = () => {};
context.render = () => { root.innerHTML = ''; };
context.pickArtworkColor = async () => '#123456';
context.toast = () => {};
vm.runInContext(html.slice(start, end), context);
context.renderColorPicker();
const header = root.children[0];
assert.equal(header.className, 'picker-header');
assert.equal(header.children[0].className, 'picker-icon picker-eyedropper');
assert.equal(header.children[1].className, 'picker-icon picker-close');
await header.children[0].onclick();
assert.equal(context.state.textColor, '#123456', 'Picked color previews in the current target');
header.children[1].onclick();
assert.equal(context.state.textColor, '#ff0000', 'Close rolls back a sampled color');
assert.equal(context.state.colorPicker, null);
assert.equal(context.history.past.length, 0);

context.state.colorPicker = 'text';
context.pickerBefore = context.snapshotState();
context.renderColorPicker();
await root.children[0].children[0].onclick();
root.children[3].children.at(-1).children[1].onclick();
assert.equal(context.state.textColor, '#123456', 'Confirm preserves the sampled color');
assert.equal(context.state.colorPicker, null);
assert.equal(context.history.past.length, 1);

let release;
context.state.colorPicker = 'text';
context.pickerBefore = context.snapshotState();
context.pickArtworkColor = () => new Promise(resolve => { release = resolve; });
context.renderColorPicker();
const pendingHeader = root.children[0];
const pending = pendingHeader.children[0].onclick();
pendingHeader.children[1].onclick();
release('#abcdef');
await pending;
assert.equal(context.state.textColor, '#123456', 'A stale sample must not change color after closing');
assert.equal(context.history.past.length, 1);

const listeners = new Map();
context.window = {
  innerWidth: 390,
  addEventListener: (name, handler) => listeners.set(name, handler),
  removeEventListener: name => listeners.delete(name)
};
context.document.body = new Element();
context.frame = { querySelector: () => ({ getBoundingClientRect: () => bounds }) };
canvas.toDataURL = () => 'data:image/png;base64,dGVzdA==';
context.exportNativeDesignCanvas = async () => canvas;
context.clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sampleStart = html.indexOf('    async function pickArtworkColor()');
vm.runInContext(html.slice(sampleStart, html.indexOf('    let pickerBefore', sampleStart)), context);
context.state.colorPicker = 'text';
context.pickerBefore = context.snapshotState();
pixels.data = [18, 52, 86, 255];
const selection = context.pickArtworkColor();
await new Promise(resolve => setImmediate(resolve));
const overlay = context.document.body.children[0];
assert.equal(root.style.visibility, 'hidden');
const event = { pointerId: 1, clientX: 155, clientY: 280, target: { closest: () => null }, preventDefault() {} };
overlay.onpointerdown(event);
overlay.onpointerup(event);
assert.equal(await selection, '#123456');
assert.equal(root.style.visibility, '');
assert.equal(context.document.body.children.length, 0);
assert.equal(listeners.size, 0, 'Sampling removes temporary global listeners');
const canceled = context.pickArtworkColor();
await new Promise(resolve => setImmediate(resolve));
context.document.body.children[0].children[2].onclick();
assert.equal(await canceled, null);
assert.equal(root.style.visibility, '');
console.log('PASS: cached offline ring, pixel coordinates/alpha, header controls, cancel/confirm, stale result guard and sampling overlay cleanup');
