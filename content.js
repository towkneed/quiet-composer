(() => {
  'use strict';
  const protocol = globalThis.QuietComposerProtocol;
  const MARK = 'data-quiet-composer-hidden';
  const UI = 'data-quiet-composer-ui';
  const EDITOR = 'textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';
  const PROTECTED = 'html, body, form, input, textarea, button, select, [role="button"], [role="textbox"], [contenteditable]';
  let settings = { ...protocol.DEFAULTS };
  let settingsError = '';
  let settingsRevision = 0;
  let frame = 0;
  let cancelPick = null;
  const hidden = new Set();
  /** Find editor-owned containers without including the transcript or picker. */
  function scopes() {
    const result = new Set();
    for (const editor of document.querySelectorAll(EDITOR)) {
      if (editor.closest(`[${UI}]`)) continue;
      const scope = editor.closest('form') || editor.parentElement?.parentElement;
      if (scope && scope !== document.body && scope !== document.documentElement) result.add(scope);
    }
    return [...result];
  }
  /** Permit only non-editable overlay targets; the observed inert widget is special. */
  function safe(element, scope) {
    // Permit the observed inert prediction widget and its descendants,
    // even though ProseMirror embeds it inside the editor.
    const widget = element instanceof HTMLElement
      ? element.closest('[data-cumberbatch][aria-hidden="true"][contenteditable="false"][inert]')
      : null;
    if (widget && element !== scope && scope.contains(element)
        && widget.closest('[data-composer-input] .ProseMirror[contenteditable="true"]')
        && !element.matches(`${EDITOR}, input, button, select, [role="button"], [role="textbox"]`)
        && !element.closest(`[${UI}], [data-message-author-role], button, [role="button"]`)
        && !element.querySelector(`${EDITOR}, input, button, select, [role="button"], [role="textbox"]`)) return true;
    return element instanceof HTMLElement && element !== scope && scope.contains(element)
      && !element.matches(PROTECTED) && !element.isContentEditable
      && !element.closest(`[${UI}], [data-message-author-role], button, [role="button"], ${EDITOR}`)
      && !element.querySelector(`${EDITOR}, input, button, select, [role="button"], [role="textbox"]`);
  }
  /** @param {string} selector @returns {Set<HTMLElement>} Safe composer targets. */
  function matches(selector) {
    const result = new Set();
    // Validate even if no composer is currently mounted.
    document.querySelector(selector);
    for (const scope of scopes()) {
      for (const element of scope.querySelectorAll(selector)) {
        if (safe(element, scope)) result.add(element);
      }
    }
    return result;
  }
  function refresh() {
    frame = 0;
    if (document.documentElement) {
      document.documentElement.setAttribute('data-quiet-composer-enabled', settings.enabled ? 'true' : 'false');
      if (settingsError) document.documentElement.setAttribute('data-quiet-composer-error', settingsError);
      else document.documentElement.removeAttribute('data-quiet-composer-error');
    }
    let next = new Set();
    if (settings.enabled && settings.selector) {
      next = matches(settings.selector);
    }
    for (const el of hidden) if (!next.has(el)) el.removeAttribute(MARK);
    for (const el of next) if (!el.hasAttribute(MARK)) el.setAttribute(MARK, '');
    hidden.clear(); for (const el of next) hidden.add(el);
  }
  // One frame and one observer belong to this content-script document. Browser
  // document disposal releases them; picker cleanup releases its key listener.
  function schedule() { if (!frame) frame = requestAnimationFrame(refresh); }
  /** Install validated settings. A storage/syntax failure disables hiding visibly. */
  function acceptSettings(value) {
    try {
      const parsed = protocol.parseSettings(value);
      if (parsed.selector) document.querySelector(parsed.selector);
      settings = parsed;
      settingsError = '';
    } catch (error) {
      settings = { selector: '', enabled: false };
      settingsError = 'invalid-settings';
      console.warn('Quiet Composer: invalid settings; hiding disabled.', error);
    }
    schedule();
  }
  /** Derive a reusable selector, preferring stable widget attributes over position. */
  function selectorFor(element, scope) {
    const unique = s => {
      try { const a = scope.querySelectorAll(s); return a.length === 1 && a[0] === element; }
      catch { return false; }
    };
    if (element.id) {
      const s = `#${CSS.escape(element.id)}`;
      if (unique(s)) return s;
    }
    if (element.hasAttribute('data-cumberbatch')) return '[data-cumberbatch]';
    for (const attr of ['data-testid', 'data-test-id', 'data-cy']) {
      const value = element.getAttribute(attr);
      if (value) {
        const s = `[${attr}=${CSS.escape(value)}]`;
        if (unique(s)) return s;
      }
    }
    for (const cls of element.classList) {
      if (/prediction|suggestion|ghost|completion/i.test(cls)) {
        const s = `.${CSS.escape(cls)}`;
        if (unique(s)) return s;
      }
    }
    const parts = [];
    for (let node = element; node && node !== scope; node = node.parentElement) {
      const siblings = [...node.parentElement.children].filter(e => e.tagName === node.tagName);
      parts.unshift(`${node.localName}:nth-of-type(${siblings.indexOf(node) + 1})`);
    }
    return ':scope > ' + parts.join(' > ');
  }
  function startPick() {
    if (cancelPick) cancelPick();
    if (!scopes().length) return { ok: false, error: 'No composer found. Open a conversation and try again.' };
    const pane = document.createElement('div');
    pane.setAttribute(UI, '');
    pane.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:transparent';
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;border:2px solid #1987ff;background:#1987ff18;pointer-events:none;display:none';
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;background:#172436;color:white;padding:12px;font:14px system-ui;pointer-events:none;white-space:pre-wrap';
    label.textContent = 'Point at the gray suggestion, then click. Esc cancels. The blue box must cover only the suggestion.';
    pane.append(box, label); document.documentElement.append(pane);
    let selected = null;
    function targetAt(x, y) {
      const candidates = [];
      for (const scope of scopes()) {
        for (const el of scope.querySelectorAll('*')) {
          if (!safe(el, scope)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
          const computed = getComputedStyle(el);
          if (computed.display === 'none' || computed.visibility === 'hidden') continue;
          candidates.push({ el, scope, r, area: r.width * r.height });
        }
      }
      candidates.sort((a, b) => a.area - b.area || (a.el.contains(b.el) ? 1 : -1));
      return candidates[0] || null;
    }
    function cleanup() {
      pane.remove(); document.removeEventListener('keydown', key, true); cancelPick = null;
    }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(); } }
    pane.addEventListener('mousemove', e => {
      selected = targetAt(e.clientX, e.clientY);
      if (!selected) { box.style.display = 'none'; return; }
      const { r, el, scope } = selected;
      Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, boxSizing: 'border-box' });
      label.textContent = `Click only if the box covers the suggestion. Esc cancels.\n${selectorFor(el, scope)}`;
    });
    pane.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      selected = targetAt(e.clientX, e.clientY);
      if (!selected) return;
      const selector = selectorFor(selected.el, selected.scope);
      try {
        const next = protocol.parseSettings({ selector, enabled: true });
        await chrome.storage.local.set(next);
        cleanup();
      }
      catch { label.textContent = 'Could not save the rule. Press Esc, reload the page and try again.'; }
    });
    document.addEventListener('keydown', key, true); cancelPick = cleanup;
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender?.id !== chrome.runtime.id) {
      respond({ ok: false, error: 'Unrecognized extension sender.' });
      return;
    }
    let request;
    try { request = protocol.parseRequest(message); }
    catch (error) { respond({ ok: false, error: error.message }); return; }
    if (request.type === protocol.PICK) respond(startPick());
    else if (request.type === protocol.CHECK) {
      try {
        respond({ ok: true, count: matches(request.selector).size });
      } catch (error) {
        if (error.name !== 'SyntaxError') throw error;
        respond({ ok: false, error: 'Invalid CSS selector syntax.' });
      }
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const next = { ...settings };
    let relevant = false;
    for (const key of ['selector', 'enabled']) {
      if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
      relevant = true;
      next[key] = Object.prototype.hasOwnProperty.call(changes[key], 'newValue')
        ? changes[key].newValue : protocol.DEFAULTS[key];
    }
    if (relevant) {
      settingsRevision += 1;
      acceptSettings(next);
    }
  });
  chrome.storage.local.get(protocol.DEFAULTS).then(value => {
    // A delayed initial read cannot overwrite a newer storage-change event.
    if (settingsRevision === 0) acceptSettings(value);
  }).catch(error => {
    if (settingsRevision !== 0) return;
    settings = { selector: '', enabled: false };
    settingsError = 'storage-unavailable';
    console.warn('Quiet Composer: settings could not be read; hiding disabled.', error);
    schedule();
  });
  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'id', 'data-testid', 'data-test-id', 'contenteditable', 'role', 'data-cumberbatch', 'inert', 'aria-hidden']
  });
  schedule();
})();
