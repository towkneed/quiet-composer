const protocol = globalThis.QuietComposerProtocol;
const selector = document.getElementById('selector');
const enabled = document.getElementById('enabled');
const status = document.getElementById('status');
const loaded = chrome.storage.local.get(protocol.DEFAULTS).then(value => {
  const s = protocol.parseSettings(value);
  selector.value = s.selector;
  enabled.checked = s.enabled;
}).catch(error => {
  selector.value = '';
  enabled.checked = false;
  status.textContent = `Settings could not be loaded: ${error.message || 'storage unavailable'}`;
});
/** Send a request to the active ChatGPT tab and validate its reply shape. */
async function message(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://chatgpt.com/')) {
    throw new Error('Open a ChatGPT page first. Refresh it once after installing this extension.');
  }
  return protocol.parseReply(await chrome.tabs.sendMessage(tab.id, payload), payload.type);
}
async function run(action) {
  try { await loaded; await action(); }
  catch (e) { status.textContent = e.message || 'Refresh the ChatGPT page and try again.'; }
}
document.getElementById('pick').onclick = () => run(async () => {
  const response = await message({ type: protocol.PICK });
  if (!response.ok) throw new Error(response.error);
  window.close();
});
document.getElementById('save').onclick = () => run(async () => {
  const value = selector.value.trim();
  const next = protocol.parseSettings({ selector: value, enabled: enabled.checked });
  let summary;
  if (value) {
    const response = await message({ type: protocol.CHECK, selector: value });
    if (!response.ok) throw new Error(response.error);
    summary = `Saved. ${response.count} safe composer match(es) currently visible in the DOM.`;
  } else summary = enabled.checked ? 'Saved. The identified prediction widget is hidden automatically.' : 'Saved. Suggestion hiding is off.';
  await chrome.storage.local.set(next);
  status.textContent = summary;
});
document.getElementById('clear').onclick = () => run(async () => {
  await chrome.storage.local.set({ selector: '', enabled: false });
  selector.value = ''; enabled.checked = false;
  status.textContent = 'Cleared. Hidden overlays are restored.';
});
