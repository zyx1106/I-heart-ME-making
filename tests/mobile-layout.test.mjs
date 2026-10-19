import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../figma-doing-interactive.html', import.meta.url), 'utf8');
const from = html.indexOf('    let settledViewport = null;');
const to = html.indexOf('    window.addEventListener("resize", fit);', from);
assert.ok(from >= 0 && to > from);
const handlers = {};
const pane = { style: {} }, editor = { style: {} }, scene = { style: {} }, app = { style: {} };
const notice = { style: {} };
const scroll = { scrollTop: 27, classList: { contains: name => name === 'editor-scroll' } };
const input = { style: {}, matches: () => true };
let release;
const context = {
  frame: {
    style: {},
    querySelector: selector => ({ '.preview-pane': pane, '.editor-pane': editor, '.editor-scroll': scroll })[selector],
    querySelectorAll: () => [input]
  },
  window: {
    innerWidth: 390, innerHeight: 844, scrollX: 0, scrollY: 0,
    visualViewport: { height: 844, offsetTop: 0 },
    scrollTo() { this.scrollX = 0; this.scrollY = 0; }
  },
  document: {
    activeElement: null,
    getElementById: id => id === 'app' ? app : id === 'toast' ? notice : scene,
    addEventListener: (name, handler) => { handlers[name] = handler; }
  },
  clearTimeout() {},
  setTimeout: callback => { release = callback; return 1; }
};
vm.createContext(context);
vm.runInContext(html.slice(from, to), context);
context.fit();
const initial = JSON.stringify([context.frame.style, pane.style, editor.style, scene.style]);
const previewScale = scene.style.transform;
handlers.focusin({ target: input });
assert.equal(scene.style.transform, previewScale, 'Keep canvas, type and toolbar at their original display scale');
assert.ok(Number.parseFloat(scene.style.top) < 0, 'Crop the upper preview edge instead of shrinking controls');
assert.ok(Number.parseFloat(app.style.height) < 844 * 0.5, 'Reserve a keyboard-safe area even if neither viewport reports the keyboard');
assert.equal(app.style.position, 'fixed', 'Ignore body safe-area padding while positioning the focused editor');
assert.ok(Number.parseFloat(editor.style.top) + 64 + 27 + 40 + 12 <= Number.parseFloat(app.style.height));
context.window.innerHeight = 460;
context.fit();
assert.equal(app.style.height, '436px', 'Use innerHeight when visualViewport is stale');
context.window.innerHeight = 460;
context.window.visualViewport.height = 460;
context.window.visualViewport.offsetTop = 180;
context.window.scrollY = 42;
context.fit();
assert.notEqual(JSON.stringify([context.frame.style, pane.style, editor.style, scene.style]), initial, 'Keyboard must reserve space for the field');
assert.equal(app.style.height, '436px');
const editorTop = Number.parseFloat(editor.style.top);
assert.ok(editorTop + 64 + 27 + 40 + 12 <= 460, 'Input and bottom breathing room must be above keyboard');
assert.equal(app.style.transform, 'translateY(180px)', 'Compensate visual viewport panning');
assert.ok(Number.parseFloat(notice.style.top) + 36 <= 180 + 436, 'Validation toast must stay above the keyboard');
assert.equal(context.window.scrollY, 0);
scroll.scrollTop = 180;
handlers.scroll({ target: scroll });
assert.equal(scroll.scrollTop, 0, 'The input must stay at the top of the editor while typing');
const ancestor = { scrollTop: 20, scrollLeft: 5, matches: () => true };
handlers.scroll({ target: ancestor });
assert.equal(ancestor.scrollTop, 0);
assert.equal(ancestor.scrollLeft, 0);
context.window.innerHeight = 844;
context.window.visualViewport.offsetTop = 0;
handlers.focusout();
release();
assert.equal(app.style.transform, '');
assert.equal(app.style.position, '');
assert.equal(scene.style.top, '0px');
assert.equal(notice.style.top, '');
context.window.innerHeight = 740;
context.fit();
assert.equal(app.style.height, '740px', 'Normal resizing must still work after blur');
context.window.innerWidth = 320;
context.fit();
assert.ok(Number.parseFloat(input.style.fontSize) * 320 / 390 >= 16, 'Scaled input must not fall below the mobile auto-zoom threshold');
assert.match(html, /padding-bottom: calc\(56px \+ var\(--safe-area-inset-bottom/);
assert.match(html, /content\.style\.height = `\$\{contentBottom\}px`/);
for (const width of [320, 375, 390, 430]) {
  for (const visual of [260, 350, 460, 844]) {
    const layout = context.keyboardViewportLayout({ width, height: 844 }, visual, true, 844);
    const scale = Math.min(width, 390) / 390;
    assert.ok((layout.previewHeight + 64 + 27 + 40 + 12) * scale <= layout.visibleHeight);
  }
}
context.window.innerWidth = 390;
context.window.innerHeight = 844;
context.window.visualViewport = null;
context.fit();
handlers.focusin({ target: input });
assert.ok(Number.parseFloat(app.style.height) < 844 * 0.5, 'Overlay keyboards must have a fallback without visualViewport');
handlers.focusout(); release();
context.window.innerWidth = 1024;
context.fit();
handlers.focusin({ target: input });
assert.equal(app.style.height, '844px', 'A desktop text field must not activate the mobile keyboard layout');
handlers.focusout(); release();
console.log('PASS: stable keyboard layout, viewport pan compensation, focus scroll lock, normal resize and bottom buffer');
