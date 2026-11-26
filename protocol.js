/* Shared contracts for the isolated content-script world and extension popup. */
((root) => {
  'use strict';
  const DEFAULTS = Object.freeze({ selector: '', enabled: true });
  const MAX_SELECTOR_LENGTH = 2048;
  const PICK = 'quiet-composer-pick';
  const CHECK = 'quiet-composer-check';

  /** @param {unknown} value @param {string[]} keys @returns {boolean} */
  function hasExactKeys(value, keys) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === keys.length
      && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }

  /** Validate a selector's transport bound; DOM syntax is checked by its caller.
   * @param {unknown} selector @returns {string}
   */
  function parseSelector(selector) {
    if (typeof selector !== 'string' || selector.length > MAX_SELECTOR_LENGTH) {
      throw new TypeError('CSS selector must be a string of at most 2,048 characters.');
    }
    return selector;
  }

  /** Return an independent, closed settings record or reject corrupt storage.
   * @param {unknown} value @returns {{selector: string, enabled: boolean}}
   */
  function parseSettings(value) {
    if (!hasExactKeys(value, ['selector', 'enabled']) || typeof value.enabled !== 'boolean') {
      throw new TypeError('Invalid saved settings. Clear the rule or save valid settings.');
    }
    return { selector: parseSelector(value.selector), enabled: value.enabled };
  }

  /** Decode a closed popup-to-content request, rejecting unknown operations.
   * @param {unknown} value @returns {{type: string, selector?: string}}
   */
  function parseRequest(value) {
    if (hasExactKeys(value, ['type']) && value.type === PICK) return { type: PICK };
    if (hasExactKeys(value, ['type', 'selector']) && value.type === CHECK) {
      return { type: CHECK, selector: parseSelector(value.selector) };
    }
    throw new TypeError('Invalid Quiet Composer request.');
  }

  /** Validate the content reply before the popup displays a success message.
   * @param {unknown} value @param {string} type
   * @returns {{ok: boolean, count?: number, error?: string}}
   */
  function parseReply(value, type) {
    if (hasExactKeys(value, ['ok', 'error']) && value.ok === false
        && typeof value.error === 'string' && value.error.length > 0 && value.error.length <= 200) {
      return { ok: false, error: value.error };
    }
    if (type === PICK && hasExactKeys(value, ['ok']) && value.ok === true) return { ok: true };
    if (type === CHECK && hasExactKeys(value, ['ok', 'count']) && value.ok === true
        && Number.isSafeInteger(value.count) && value.count >= 0) {
      return { ok: true, count: value.count };
    }
    throw new TypeError('Invalid reply. Refresh the ChatGPT tab and try again.');
  }

  const api = Object.freeze({ DEFAULTS, MAX_SELECTOR_LENGTH, PICK, CHECK,
    parseSelector, parseSettings, parseRequest, parseReply });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuietComposerProtocol = api;
})(globalThis);
