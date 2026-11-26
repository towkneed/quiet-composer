const selector = document.getElementById('selector');
const enabled = document.getElementById('enabled');
const status = document.getElementById('status');
const loaded = chrome.storage.local.get({ selector: '', enabled: true }).then(s => {
  selector.value = s.selector;
  enabled.checked = s.enabled;
});
async function message(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://chatgpt.com/')) {
    throw new Error('Open a ChatGPT page first. Refresh it once after installing this extension.');
  }
  return chrome.tabs.sendMessage(tab.id, payload);
}
async function run(action) {
  try { await loaded; await action(); }
  catch (e) { status.textContent = e.message || 'Refresh the ChatGPT page and try again.'; }
}
document.getElementById('pick').onclick = () => run(async () => {
  const response = await message({ type: 'quiet-composer-pick' });
  if (!response.ok) throw new Error(response.error);
  window.close();
});
document.getElementById('save').onclick = () => run(async () => {
  const value = selector.value.trim();
  if (value) {
    const response = await message({ type: 'quiet-composer-check', selector: value });
    if (!response.ok) throw new Error(response.error);
    status.textContent = `Saved. ${response.count} safe composer match(es) currently visible in the DOM.`;
  } else status.textContent = enabled.checked ? 'Saved. The identified prediction widget is hidden automatically.' : 'Saved. Suggestion hiding is off.';
  await chrome.storage.local.set({ selector: value, enabled: enabled.checked });
});
document.getElementById('clear').onclick = () => run(async () => {
  await chrome.storage.local.set({ selector: '', enabled: false });
  selector.value = ''; enabled.checked = false;
  status.textContent = 'Cleared. Hidden overlays are restored.';
});
