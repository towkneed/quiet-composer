'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const protocol = require('../protocol.js');
const ROOT = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('settings reject malformed storage and preserve the caller record', () => {
  const input = { selector: '[data-cumberbatch]', enabled: false };
  const actual = protocol.parseSettings(input);
  assert.deepEqual(actual, input);
  assert.notEqual(actual, input);
  actual.enabled = true;
  assert.equal(input.enabled, false);
  for (const bad of [null, [], {}, { selector: '', enabled: 'false' },
    { selector: 7, enabled: true }, { selector: '', enabled: true, extra: 1 }]) {
    assert.throws(() => protocol.parseSettings(bad), TypeError);
  }
  assert.equal(protocol.parseSelector('x'.repeat(2048)).length, 2048);
  assert.throws(() => protocol.parseSelector('x'.repeat(2049)), TypeError);
});

test('requests and replies have closed operation-specific shapes', () => {
  assert.deepEqual(protocol.parseRequest({ type: protocol.PICK }), { type: protocol.PICK });
  assert.deepEqual(protocol.parseRequest({ type: protocol.CHECK, selector: '' }),
    { type: protocol.CHECK, selector: '' });
  for (const bad of [null, [], {}, { type: 'other' },
    { type: protocol.PICK, selector: '' }, { type: protocol.CHECK, selector: false }]) {
    assert.throws(() => protocol.parseRequest(bad), TypeError);
  }
  assert.deepEqual(protocol.parseReply({ ok: true, count: 0 }, protocol.CHECK), { ok: true, count: 0 });
  assert.deepEqual(protocol.parseReply({ ok: false, error: 'Rejected' }, protocol.CHECK),
    { ok: false, error: 'Rejected' });
  for (const bad of [null, { ok: 'true', count: 0 }, { ok: true },
    { ok: true, count: -1 }, { ok: true, count: 0.5 }, { ok: true, count: Infinity },
    { ok: true, count: 0, extra: true }, { ok: false, error: '' }]) {
    assert.throws(() => protocol.parseReply(bad, protocol.CHECK), TypeError);
  }
});

function contentHarness(initial) {
  const frames = [], attributes = new Map(), warnings = [];
  let listener, changed;
  const context = vm.createContext({
    console: { warn: (...args) => warnings.push(args) },
    document: {
      documentElement: {
        setAttribute: (k, v) => attributes.set(k, v),
        removeAttribute: k => attributes.delete(k)
      },
      querySelector: s => {
        if (s === '[') { const e = new Error('Invalid selector'); e.name = 'SyntaxError'; throw e; }
        return null;
      },
      querySelectorAll: () => []
    },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    MutationObserver: class { observe() {} },
    chrome: {
      runtime: { id: 'ours', onMessage: { addListener: fn => { listener = fn; } } },
      storage: {
        local: { get: () => initial.promise },
        onChanged: { addListener: fn => { changed = fn; } }
      }
    }
  });
  vm.runInContext(source('protocol.js'), context);
  vm.runInContext(source('content.js'), context);
  return {
    attributes, warnings,
    flush: () => { while (frames.length) frames.shift()(); },
    change: value => changed(value, 'local'),
    request: (value, sender = { id: 'ours' }) => {
      let result;
      listener(value, sender, x => { result = x; });
      return JSON.parse(JSON.stringify(result));
    }
  };
}

test('content rejects foreign senders, missing messages and unknown operations', async () => {
  const initial = deferred(), h = contentHarness(initial);
  initial.resolve({ selector: '', enabled: true });
  await tick(); h.flush();
  assert.match(h.request({ type: protocol.PICK }, { id: 'other' }).error, /sender/);
  assert.equal(h.request(null).ok, false);
  assert.equal(h.request({ type: 'other' }).ok, false);
  assert.deepEqual(h.request({ type: protocol.CHECK, selector: '' }), { ok: true, count: 0 });
  assert.deepEqual(h.request({ type: protocol.CHECK, selector: '[' }),
    { ok: false, error: 'Invalid CSS selector syntax.' });
});

test('corrupt settings disable hiding, expose a diagnostic and recover on a valid change', async () => {
  const initial = deferred(), h = contentHarness(initial);
  initial.resolve({ selector: '', enabled: 'false' });
  await tick(); h.flush();
  assert.equal(h.attributes.get('data-quiet-composer-enabled'), 'false');
  assert.equal(h.attributes.get('data-quiet-composer-error'), 'invalid-settings');
  assert.equal(h.warnings.length, 1);
  h.change({ selector: { newValue: '' }, enabled: { newValue: true } }); h.flush();
  assert.equal(h.attributes.get('data-quiet-composer-enabled'), 'true');
  assert.equal(h.attributes.has('data-quiet-composer-error'), false);
  h.change({ selector: { newValue: '[' } }); h.flush();
  assert.equal(h.attributes.get('data-quiet-composer-enabled'), 'false');
});

test('storage read failure disables hiding with a distinct diagnostic', async () => {
  const initial = deferred(), h = contentHarness(initial);
  initial.reject(new Error('Storage unavailable'));
  await tick(); h.flush();
  assert.equal(h.attributes.get('data-quiet-composer-enabled'), 'false');
  assert.equal(h.attributes.get('data-quiet-composer-error'), 'storage-unavailable');
  assert.equal(h.warnings.length, 1);
});

test('delayed initial settings cannot undo a newer disable event', async () => {
  const initial = deferred(), h = contentHarness(initial);
  h.change({ enabled: { newValue: false } }); h.flush();
  initial.resolve({ selector: '', enabled: true });
  await tick(); h.flush();
  assert.equal(h.attributes.get('data-quiet-composer-enabled'), 'false');
});

function popupHarness({ get, set, reply } = {}) {
  const elements = Object.fromEntries(['selector', 'enabled', 'status', 'pick', 'save', 'clear']
    .map(k => [k, { value: '', checked: true, textContent: '' }]));
  const writes = [];
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    window: { close() {} },
    chrome: {
      storage: { local: {
        get: get || (async () => ({ selector: '', enabled: true })),
        set: async value => { writes.push(value); if (set) await set(value); }
      } },
      tabs: {
        query: async () => [{ id: 1, url: 'https://chatgpt.com/' }],
        sendMessage: async () => reply || { ok: true, count: 1 }
      }
    }
  });
  vm.runInContext(source('protocol.js'), context);
  vm.runInContext(source('popup.js'), context);
  return { elements, writes };
}

test('popup reports success only after persistence, and displays failed writes', async () => {
  const pending = deferred(), h = popupHarness({ set: () => pending.promise });
  await tick();
  const saving = h.elements.save.onclick();
  await tick();
  assert.doesNotMatch(h.elements.status.textContent, /Saved/);
  pending.reject(new Error('Write denied'));
  await saving;
  assert.equal(h.elements.status.textContent, 'Write denied');
  const success = popupHarness(); await tick();
  await success.elements.save.onclick();
  assert.match(success.elements.status.textContent, /^Saved/);
});

test('popup shows load errors, permits reset and rejects malformed replies before writing', async () => {
  const h = popupHarness({ get: async () => ({ selector: 7, enabled: true }) });
  await tick();
  assert.match(h.elements.status.textContent, /could not be loaded/);
  assert.equal(h.elements.enabled.checked, false);
  await h.elements.clear.onclick();
  assert.equal(h.writes.length, 1);
  assert.match(h.elements.status.textContent, /^Cleared/);
  const bad = popupHarness({ reply: { ok: 'yes', count: 1 } }); await tick();
  bad.elements.selector.value = '[data-cumberbatch]';
  await bad.elements.save.onclick();
  assert.equal(bad.writes.length, 0);
  assert.match(bad.elements.status.textContent, /Invalid reply/);
});
