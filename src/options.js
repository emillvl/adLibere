'use strict';
const api = globalThis.browser || globalThis.chrome;
const status = document.querySelector('#status');
const enabledBox = document.querySelector('#enabled');
function report(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
async function message(value) {
  const result = await api.runtime.sendMessage(value);
  if (!result?.ok) throw new Error(result?.error || 'The extension did not respond.');
  return result;
}
function formatDate(timestamp) {
  if (!timestamp) return 'never';
  return new Date(timestamp).toLocaleString();
}
async function render() {
  const state = await message({ type: 'get-state' });
  enabledBox.checked = state.enabled;
  document.querySelector('#static-rules').textContent = state.staticRuleCount.toLocaleString();
  document.querySelector('#list-rules').textContent = state.listRuleCount.toLocaleString();
  document.querySelector('#dynamic-rules').textContent = state.dynamicRuleCount.toLocaleString();
  document.querySelector('#updated').textContent = formatDate(state.meta?.updatedAt);
  report(`Rules active on all sites${state.enabled ? '' : ' — protection is paused'}.`);
}
enabledBox.addEventListener('change', async () => {
  enabledBox.disabled = true;
  try { await message({ type: 'set-enabled', enabled: enabledBox.checked }); await render(); }
  catch (error) { report(error.message, true); enabledBox.checked = !enabledBox.checked; }
  finally { enabledBox.disabled = false; }
});
document.querySelector('#refresh').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await message({ type: 'refresh-now' }); await render(); report('Filter lists refreshed.'); }
  catch (error) { report(error.message, true); }
  finally { button.disabled = false; }
});
document.querySelector('#export').addEventListener('click', async () => {
  try {
    const { text } = await message({ type: 'export-filters' });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'adlibere.txt'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('Filter list exported.');
  } catch (error) { report(error.message, true); }
});
render().catch(error => report(error.message, true));
