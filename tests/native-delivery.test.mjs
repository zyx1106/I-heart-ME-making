import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../minitool-export.js', import.meta.url), 'utf8');
const data = 'data:image/png;base64,dGVzdA==';
function setup(api = {}, render = async () => ({ toDataURL: () => data })) {
  const messages = [];
  const calls = [];
  const context = {
    window: { xhs: { miniTool: {
      saveImageToPhotosAlbum: async payload => { calls.push(payload); },
      postNote: async payload => { calls.push(payload); }, ...api
    } } },
    snapshotState: () => 'design', toast: message => messages.push(message),
    console: { warn() {}, error() {} }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.exportNativeDesignCanvas = render;
  return { context, messages, calls };
}

for (const mode of ['save', 'post']) {
  for (const writeTempFile of [async () => ({ filePath: '/tmp/design.png' }), async () => ({}), async () => { throw new Error('write:fail'); }]) {
    const { context, calls } = setup({ writeTempFile });
    await context.deliverMiniToolImage(mode);
    assert.equal(calls.length, 1);
    const path = mode === 'save' ? calls[0].filePath : calls[0].mediaInfo.image_resources[0].url;
    assert.ok(path === '/tmp/design.png' || path === data);
    if (mode === 'post') assert.equal('pageType' in calls[0], false);
  }
}
for (const [errMsg, expected] of [['save:fail permission denied', '请允许相册访问权限后重试'], ['save:cancel', '已取消操作'], ['save:fail timeout', '保存相册失败：save:fail timeout']]) {
  const { context, messages } = setup({ saveImageToPhotosAlbum: async () => ({ errMsg }) });
  await context.deliverMiniToolImage('save');
  assert.equal(messages.at(-1), expected);
  assert.ok(!messages.includes('图片已保存到相册'));
}
let release;
let renders = 0;
const pending = setup({}, () => { renders++; return new Promise(resolve => { release = resolve; }); });
const first = pending.context.deliverMiniToolImage('save');
await pending.context.deliverMiniToolImage('post');
assert.equal(renders, 1);
release({ toDataURL: () => data });
await first;
assert.equal(pending.calls.length, 1, 'Repeated clicks must not submit twice');
await pending.context.deliverMiniToolImage('save');
assert.equal(renders, 1, 'Reuse a prepared image of an unchanged design');
let attempts = 0;
const retry = setup({}, async () => {
  if (++attempts === 1) throw new Error('image failed');
  return { toDataURL: () => data };
});
await retry.context.deliverMiniToolImage('save');
await retry.context.deliverMiniToolImage('save');
assert.equal(attempts, 2, 'A failed generation must not poison later attempts');
assert.equal(retry.calls.length, 1);
assert.match(source, /if \(sticker\.flipX\) context\.scale\(-1, 1\)/);
console.log('PASS: native save/post paths, temporary-file fallbacks, failure/cancel feedback, duplicate guard, cache and retry');
