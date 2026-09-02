// Run with node scripts/test_activity_page.cjs; no device or credentials needed.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../data/webinterface/activity.js'), 'utf8');
function element() {
  return { textContent: '', disabled: false, childNodes: [], classList: { toggle() {} },
    appendChild(child) { this.childNodes.push(child); }, setAttribute() {},
    addEventListener() {}, querySelector() { return element(); } };
}
function setup(fetch) {
  const elements = new Map();
  const timers = new Set();
  const context = { window: {}, AbortController, fetch,
    setTimeout(fn) { timers.add(fn); return fn; }, clearTimeout(fn) { timers.delete(fn); },
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }, querySelectorAll: () => [], createElement: element, createTextNode: element } };
  vm.runInNewContext(source, context);
  const page = context.window.FlowWebPages.activity.create({ tr: (_, text) => text,
    currentWebLocaleTag: () => 'fr-FR' });
  return { page, timers, status: elements.get('activityLogStatus'), button: elements.get('activityRefreshBtn') };
}
const result = (payload) => ({ ok: true, json: async () => payload });
const empty = { available: true, events: [], count: 0, complete: true };
async function main() {
  let requests = [];
  const a = setup((url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve });
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const first = a.page.show();
  assert.equal(a.page.refresh(), first, 'deduplicate overlapping loads');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /limit=16/);
  a.page.hide();
  assert.equal(requests[0].options.signal.aborted, true);
  const second = a.page.show();
  await first;
  assert.equal(a.button.disabled, true, 'old request must not reset new load');
  requests[1].resolve(result(empty));
  await second;
  assert.equal(a.button.disabled, false);
  assert.equal(a.timers.size, 0);
  const b = setup(async () => ({ ok: false, status: 401 }));
  await b.page.show();
  assert.match(b.status.textContent, /administrateur/);
  const c = setup(async () => { throw new Error('network failure'); });
  await c.page.show();
  assert.match(c.status.textContent, /network failure/);
  const d = setup(async () => result({ available: false, events: [] }));
  await d.page.show();
  assert.match(d.status.textContent, /indisponible/);
  const e = setup(async () => result({ available: true, events: [], count: 1, next: 0 }));
  await e.page.show();
  assert.match(e.status.textContent, /pagination invalide/);
  const f = setup((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const stalled = f.page.show();
  [...f.timers][0]();
  await stalled;
  assert.match(f.status.textContent, /délai/);
  let calls = 0;
  const g = setup(async () => result(++calls === 1
    ? { available: true, events: [{ seq: 1 }], count: 1, next: 1, complete: false }
    : empty));
  await g.page.show();
  assert.equal(calls, 2);
  assert.doesNotMatch(g.status.textContent, /indisponible/);
  console.log('Activity page: concurrency, cancellation, errors, timeout and pagination OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
