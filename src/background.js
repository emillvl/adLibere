if (typeof importScripts === 'function') importScripts('core.js', 'catalog.js', 'build-info.js');
const api = globalThis.browser || globalThis.chrome;
const core = globalThis.StreamGuardCore;
const catalog = globalThis.StreamGuardCatalog;
const build = globalThis.StreamGuardBuild || {};
let sequence = Promise.resolve();
const serialize = task => { const next = sequence.then(task, task); sequence = next.catch(() => {}); return next; };
const scriptIds = ['stream-guard-main', 'stream-guard-isolated'];
const LISTS = [
  { id: 'easylist', name: 'EasyList', url: 'https://easylist.to/easylist/easylist.txt' },
  { id: 'easyprivacy', name: 'EasyPrivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' },
  { id: 'adguard-base', name: 'AdGuard Base', url: 'https://filters.adtidy.org/extension/ublock/filters/2.txt' },
];
const REFRESH_MS = 24 * 60 * 60 * 1000;
const dynamicLimit = () => api.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES || 5000;

async function enabled() {
  const { enabled } = await api.storage.local.get('enabled');
  return enabled !== false;
}
async function curatedRules() {
  return core.networkRules(catalog.networks.flatMap(network => network.rules));
}
async function syncDynamicRules() {
  if (!(await enabled())) {
    const previous = await api.declarativeNetRequest.getDynamicRules();
    if (previous.length) await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: previous.map(rule => rule.id) });
    return 0;
  }
  const curated = await curatedRules();
  const { listRules = [] } = await api.storage.local.get('listRules');
  const budget = Math.max(0, dynamicLimit() - curated.length - 4);
  const listRulesSlice = listRules.slice(0, budget);
  // Offset catalog IDs to avoid collisions with refreshed list rules.
  const curatedOffset = curated.map((rule, index) => ({ ...rule, id: budget + index + 1 }));
  const rules = [...listRulesSlice, ...curatedOffset];
  const previous = await api.declarativeNetRequest.getDynamicRules();
  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: previous.map(rule => rule.id), addRules: rules });
  return rules.length;
}
async function syncRulesets() {
  if (!build.rulesetIds?.length) return;
  const options = (await enabled())
    ? { enableRulesetIds: build.rulesetIds }
    : { disableRulesetIds: build.rulesetIds };
  try { await api.declarativeNetRequest.updateEnabledRulesets(options); } catch (error) { console.warn('[adLibere] ruleset toggle failed:', error.message); }
}
async function syncContentScripts() {
  const existing = await api.scripting.getRegisteredContentScripts({ ids: scriptIds });
  if (!(await enabled())) {
    if (existing.length) await api.scripting.unregisterContentScripts({ ids: existing.map(script => script.id) });
    return;
  }
  const scripts = [
    { id: scriptIds[0], matches: ['<all_urls>'], allFrames: true, runAt: 'document_start', persistAcrossSessions: true, world: 'MAIN', js: ['main.bundle.js'] },
    { id: scriptIds[1], matches: ['<all_urls>'], allFrames: true, runAt: 'document_start', persistAcrossSessions: true, world: 'ISOLATED', js: ['content.bundle.js'] }
  ];
  const existingIds = new Set(existing.map(script => script.id));
  const updates = scripts.filter(script => existingIds.has(script.id));
  const additions = scripts.filter(script => !existingIds.has(script.id));
  if (updates.length) await api.scripting.updateContentScripts(updates);
  if (additions.length) await api.scripting.registerContentScripts(additions);
}
async function refreshLists(force = false) {
  const { meta = {} } = await api.storage.local.get('meta');
  if (!force && meta.updatedAt && Date.now() - meta.updatedAt < REFRESH_MS) return meta;
  const rules = [];
  for (const list of LISTS) {
    try {
      const response = await fetch(list.url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      rules.push(...core.filterRules(text.split(/\r?\n/), rules.length + 1));
    } catch (error) {
      console.warn(`[adLibere] ${list.name} refresh failed:`, error.message);
    }
  }
  if (!rules.length) return meta;
  const next = { updatedAt: Date.now(), ruleCount: rules.length, version: build.version || '2.0.0' };
  await api.storage.local.set({ listRules: rules, meta: next, lastError: null });
  await syncDynamicRules();
  return next;
}
// Register local protection before starting network requests.
async function fullSync() {
  await syncRulesets();
  await syncContentScripts();
  await syncDynamicRules();
}
async function refreshAndSync() {
  const meta = await refreshLists(false);
  if (meta && meta.ruleCount) await syncDynamicRules();
}
async function state() {
  const { meta = {}, listRules = [], enabled: stored } = await api.storage.local.get(['meta', 'listRules', 'enabled']);
  return {
    ok: true,
    enabled: stored !== false,
    dynamicRuleCount: (await api.declarativeNetRequest.getDynamicRules()).length,
    staticRuleCount: build.staticRuleCount || 0,
    listRuleCount: listRules.length,
    meta,
    networks: catalog.networks.map(network => ({ id: network.id, domains: network.domains })),
  };
}
// Content scripts share the extension ID, so also check the sender URL.
function trustedOptions(sender) {
  return sender.id === api.runtime.id && sender.url === api.runtime.getURL('options.html');
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (!trustedOptions(sender)) return false;
  if (!['get-state', 'set-enabled', 'refresh-now', 'export-filters'].includes(message?.type)) return false;
  serialize(async () => {
    if (message.type === 'get-state') return await state();
    if (message.type === 'set-enabled') {
      await api.storage.local.set({ enabled: message.enabled === true, lastError: null });
      await syncRulesets();
      await syncContentScripts();
      await syncDynamicRules();
      return await state();
    }
    if (message.type === 'refresh-now') {
      await refreshLists(true);
      return await state();
    }
    return { ok: true, text: core.subscription(catalog) };
  }).then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
api.action.onClicked.addListener(() => api.runtime.openOptionsPage());
api.runtime.onInstalled.addListener(details => {
  serialize(async () => {
    if (details.reason === 'update') await api.storage.local.remove(['hosts', 'lastError']);
    await api.alarms.create('refresh', { periodInMinutes: 12 * 60 });
    await api.storage.local.set({ enabled: (await enabled()) });
    await fullSync();
    serialize(refreshAndSync).catch(error => console.warn('[adLibere] list refresh failed:', error.message));
  }).catch(error => console.warn('[adLibere] install sync failed:', error.message));
});
api.runtime.onStartup.addListener(() => {
  serialize(async () => {
    await fullSync();
    serialize(refreshAndSync).catch(error => console.warn('[adLibere] list refresh failed:', error.message));
  }).catch(error => console.warn('[adLibere] startup sync failed:', error.message));
});
api.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refresh') serialize(refreshAndSync).catch(error => console.warn('[adLibere] refresh failed:', error.message));
});
