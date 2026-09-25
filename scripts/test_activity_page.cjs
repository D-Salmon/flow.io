// Run with node scripts/test_activity_page.cjs; no device or credentials needed.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../data/webinterface/activity.js'), 'utf8');
function element() {
  const classes = new Set();
  const attributes = {};
  return { textContent: '', disabled: false, childNodes: [], attributes, classList: {
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    set innerHTML(value) { this.childNodes = []; this.html = value; },
    get innerHTML() { return this.html || ''; },
    listeners: {},
    appendChild(child) { this.childNodes.push(child); }, setAttribute(name, value) { attributes[name] = String(value); },
    addEventListener(name, handler) { this.listeners[name] = handler; }, querySelector() { return element(); } };
}
function setup(fetch, confirm = () => true) {
  const elements = new Map();
  const filters = ['all', 'equipment', 'automatic', 'manual', 'alerts', 'system'].map(value => {
    const button = element();
    button.dataset = { activityFilter: value };
    return button;
  });
  const summaryFilters = ['all', 'alerts', 'manual', 'equipment'].map(value => {
    const button = element();
    button.dataset = { activitySummaryFilter: value };
    return button;
  });
  const timers = new Set();
  const context = { window: {}, AbortController, fetch, confirm,
    setTimeout(fn, delay) { if (delay === 1000) { queueMicrotask(fn); return fn; } timers.add(fn); return fn; }, clearTimeout(fn) { timers.delete(fn); },
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }, querySelectorAll: selector => selector === '[data-activity-filter]' ? filters
      : selector === '[data-activity-summary-filter]' ? summaryFilters : [], createElement: element, createTextNode: element } };
  vm.runInNewContext(source, context);
  const page = context.window.FlowWebPages.activity.create({ tr: (_, text) => text,
    currentWebLocaleTag: () => 'fr-FR', fetchWithBusyRetry: fetch });
  return { page, timers, elements, filters, summaryFilters, status: elements.get('activityLogStatus'), button: elements.get('activityRefreshBtn') };
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
  // Destructive actions are only simulated; no network or real journal is used.
  let approved = false;
  let posts = [];
  let remaining = [{ seq: 10, title: 'A' }, { seq: 11, title: 'B' }];
  const h = setup(async (url, options) => {
    if (options.method === 'POST') {
      posts.push({ url, options });
      assert.ok(options.signal);
      remaining = [];
      return result({ ok: true, delete_id: 42 });
    }
    if (url === '/api/activity/status') return result({ delete_id: 42, delete_state: 2 });
    return result({ available: true, events: remaining, count: remaining.length, complete: true });
  }, () => approved);
  await h.page.show();
  h.elements.get('activitySelectVisibleBtn').listeners.click();
  assert.match(h.elements.get('activityDeleteBtn').textContent, /\(2\)/);
  await h.elements.get('activityDeleteBtn').listeners.click();
  assert.equal(posts.length, 0, 'cancelled confirmation never sends POST');
  approved = true;
  await h.elements.get('activityDeleteBtn').listeners.click();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/api/activity/delete');
  assert.equal(decodeURIComponent(posts[0].options.body), 'ids=10,11');
  assert.match(h.status.textContent, /Sélection supprimée/);
  assert.equal(h.elements.get('activityDeleteBtn').disabled, true);
  await h.elements.get('activityPurgeBtn').listeners.click();
  assert.equal(posts[1].url, '/api/activity/purge');
  assert.equal(posts[1].options.body, '');
  assert.equal(h.timers.size, 0);

  const failure = setup(async (url, options) => {
    if (options.method === 'POST') return result({ ok: true, delete_id: 9 });
    if (url === '/api/activity/status') return result({ delete_id: 9, delete_state: 3 });
    return result({ available: true, events: [{ seq: 7 }], count: 1, complete: true });
  });
  await failure.page.show();
  failure.elements.get('activitySelectVisibleBtn').listeners.click();
  await failure.elements.get('activityDeleteBtn').listeners.click();
  assert.match(failure.status.textContent, /partielle/);
  assert.match(failure.elements.get('activityDeleteBtn').textContent, /\(1\)/);
  assert.equal(failure.elements.get('activityDeleteBtn').disabled, false);
  let singleBody;
  const single = setup(async (url, options) => {
    if (options.method === 'POST') { singleBody = options.body; return result({ ok: true, delete_id: 12 }); }
    if (url === '/api/activity/status') return result({ delete_id: 12, delete_state: 2 });
    return result({ available: true, events: [{ seq: 22, title: 'Unique' }], count: 1, complete: true });
  });
  await single.page.show();
  const walk = node => [node, ...node.childNodes.flatMap(walk)];
  const checkbox = walk(single.elements.get('activityLogList')).find(node => node.type === 'checkbox');
  assert.ok(checkbox, 'each row provides a checkbox');
  checkbox.checked = true;
  checkbox.listeners.change();
  await single.elements.get('activityDeleteBtn').listeners.click();
  assert.equal(singleBody, 'ids=22');
  let reconcile;
  let loadingCount = 0;
  const slow = setup(async (url, options) => {
    if (options.method === 'POST') return result({ ok: true, delete_id: 21 });
    if (url === '/api/activity/status') return result({ delete_id: 21, delete_state: 2 });
    if (++loadingCount === 1) return result({ available: true, events: [{ seq: 33 }], count: 1, complete: true });
    return new Promise(resolve => { reconcile = resolve; });
  });
  await slow.page.show();
  slow.elements.get('activitySelectVisibleBtn').listeners.click();
  const removing = slow.elements.get('activityDeleteBtn').listeners.click();
  await new Promise(setImmediate);
  assert.ok(reconcile, 'automatic reconciliation starts without manual refresh');
  assert.equal(slow.elements.get('activitySummaryTotal').textContent, '0', 'confirmed rows vanish before slow reload finishes');
  assert.match(slow.status.textContent, /Sélection supprimée/);
  assert.doesNotMatch(slow.status.textContent, /en cours|Chargement/);
  reconcile(result(empty));
  await removing;
  assert.equal(slow.elements.get('activitySummaryTotal').textContent, '0');

  let reads = 0;
  const reloadFailure = setup(async (url, options) => {
    if (options.method === 'POST') return result({ ok: true, delete_id: 22 });
    if (url === '/api/activity/status') return result({ delete_id: 22, delete_state: 2 });
    if (++reads > 1) throw new Error('offline');
    return result({ available: true, events: [{ seq: 44 }], count: 1, complete: true });
  });
  await reloadFailure.page.show();
  await reloadFailure.elements.get('activityPurgeBtn').listeners.click();
  assert.equal(reloadFailure.elements.get('activitySummaryTotal').textContent, '0');
  assert.match(reloadFailure.status.textContent, /Journal vidé.*Actualisation automatique impossible/);

  const classified = setup(async () => result({ available: true, count: 5, complete: true, events: [
    { seq: 51, code: 122, domain_name: 'poollogic', source: 0, source_name: 'system', reason: 5 },
    { seq: 52, code: 130, domain_name: 'poollogic', source: 3, source_name: 'unknown', reason: 3 },
    { seq: 53, code: 160, domain_name: 'poollogic', source: 4, source_name: 'safety', reason: 7, severity_name: 'warning' },
    { seq: 54, code: 220, domain_name: 'pooldevice', source: 0, source_name: 'system', reason: 4 },
    { seq: 55, code: 2, domain_name: 'system', source: 2, source_name: 'manual', reason: 4 }
  ] }));
  await classified.page.show();
  classified.filters.find(button => button.dataset.activityFilter === 'automatic').listeners.click();
  classified.elements.get('activitySelectVisibleBtn').listeners.click();
  assert.match(classified.elements.get('activityDeleteBtn').textContent, /\(2\)/,
    'Automatismes uses codes and numeric metadata without including safety alerts');
  classified.filters.find(button => button.dataset.activityFilter === 'manual').listeners.click();
  classified.elements.get('activitySelectVisibleBtn').listeners.click();
  assert.match(classified.elements.get('activityDeleteBtn').textContent, /\(2\)/,
    'Manuel includes explicit and legacy manual actions');
  assert.equal(classified.elements.get('activitySummaryManual').textContent, '2');
  classified.summaryFilters.find(button => button.dataset.activitySummaryFilter === 'alerts').listeners.click();
  classified.elements.get('activitySelectVisibleBtn').listeners.click();
  assert.match(classified.elements.get('activityDeleteBtn').textContent, /\(1\)/,
    'Alert summary tile applies the alert filter');
  assert.equal(classified.summaryFilters.find(button => button.dataset.activitySummaryFilter === 'alerts').attributes['aria-pressed'], 'true');
  assert.equal(classified.filters.find(button => button.dataset.activityFilter === 'alerts').attributes['aria-pressed'], 'true');
  classified.summaryFilters.find(button => button.dataset.activitySummaryFilter === 'all').listeners.click();
  classified.elements.get('activitySelectVisibleBtn').listeners.click();
  assert.match(classified.elements.get('activityDeleteBtn').textContent, /\(5\)/,
    'Event summary tile restores the complete journal');
  assert.equal(classified.summaryFilters.find(button => button.dataset.activitySummaryFilter === 'alerts').attributes['aria-pressed'], 'false');

  const now = Math.floor(Date.now() / 1000);
  const summaries = setup(async () => result({ available: true, count: 4, complete: true, events: [
    { seq: 61, epoch_s: now, domain_name: 'alarm', severity_name: 'warning' },
    { seq: 62, epoch_s: now, source_name: 'manual' },
    { seq: 63, epoch_s: now, domain_name: 'pooldevice', role_name: 'filtration' },
    { seq: 64, epoch_s: now - 14400, domain_name: 'alarm', severity_name: 'warning' }
  ] }));
  await summaries.page.show();
  assert.equal(summaries.elements.get('activitySummaryTotal').textContent, '4',
    'header summary covers the complete loaded journal, beyond the displayed period');
  assert.equal(summaries.elements.get('activitySummaryAlerts').textContent, '2');
  assert.match(summaries.status.textContent,
    /3 événements sur la période, dont 1 alerte, 1 action manuelle et 1 équipement/);
  summaries.summaryFilters.find(button => button.dataset.activitySummaryFilter === 'alerts').listeners.click();
  summaries.elements.get('activitySelectVisibleBtn').listeners.click();
  assert.match(summaries.elements.get('activityDeleteBtn').textContent, /\(2\)/,
    'summary tiles show every matching event in the complete journal, including older periods');
  assert.equal(summaries.elements.get('activityRangeText').textContent, 'Tout le journal');
  assert.equal(summaries.elements.get('activityPrevBtn').disabled, true);
  assert.equal(summaries.elements.get('activityNextBtn').disabled, true);
  assert.match(summaries.status.textContent, /4 événements dans le journal, dont 2 alertes/);
  summaries.filters.find(button => button.dataset.activityFilter === 'all').listeners.click();
  assert.equal(summaries.elements.get('activityPrevBtn').disabled, false,
    'returning to the three-hour view re-enables previous-period navigation');
  assert.equal(summaries.elements.get('activityNextBtn').disabled, true,
    'the next-period button remains disabled on the current period');
  console.log('Post-delete refresh: immediate view update, slow reload and reload failure OK');
  console.log('Activity deletion: confirmation, selection, clear-all and persistence failure OK');
  console.log('Activity filters: automatic and manual classification OK');
  console.log('Activity summaries: complete journal header and detailed period status OK');
  console.log('Activity page: concurrency, cancellation, errors, timeout and pagination OK');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
