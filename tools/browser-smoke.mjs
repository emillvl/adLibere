import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { validateDistribution } from './validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.resolve(process.argv[3] || path.join(root, 'dist'));
const build = validateDistribution(sourceDirectory);
const executable = process.argv[2] || process.env.ADLIBERE_BROWSER || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'chromium');
const profile = mkdtempSync(path.join(tmpdir(), 'adlibere-browser-'));
const directory = path.join(profile, 'extension');
let browser;
let socket;
let browserExited;
let server;
const failures = [];
const logs = [];
const pending = new Map();
let sequence = 0;
function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function poll(task, description) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const result = await task();
    if (result) return result;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${description}`);
}
async function attach(targetId) {
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  return sessionId;
}
async function evaluate(sessionId, expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
  return result.result.value;
}

try {
  cpSync(sourceDirectory, directory, { recursive: true });
  server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><html><head><title>adLibere smoke fixture</title></head><body><p id="normal">Normal content</p><div class="adsbox">Ad container</div><video style="width:400px;height:240px"></video><div id="overlay" style="position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2000">Overlay</div><dialog open>Protected dialog</dialog></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = spawn(executable, ['--headless=new', '--enable-unsafe-extension-debugging', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-default-apps', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  browserExited = new Promise(resolve => browser.once('exit', resolve));
  browser.on('error', error => failures.push(error.message));
  browser.stderr.on('data', data => logs.push(data.toString()));
  await poll(() => existsSync(path.join(profile, 'DevToolsActivePort')), 'isolated browser');
  const [port, endpoint] = readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') failures.push(JSON.stringify(message.params.exceptionDetails));
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') failures.push(message.params.entry.text);
  });
  const version = await send('Browser.getVersion');
  console.log(`Browser: ${version.product}`);
  const { id } = await send('Extensions.loadUnpacked', { path: directory });
  console.log(`Loaded production extension ${id}`);
  const worker = await poll(async () => (await send('Target.getTargets')).targetInfos.find(target => target.type === 'service_worker' && target.url.startsWith(`chrome-extension://${id}/`)), 'extension service worker');
  const workerSession = await attach(worker.targetId);
  // Hold downloads offline during deterministic fixtures; bundled protection stays active.
  await send('Network.enable', {}, workerSession);
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, workerSession);
  await poll(async () => (await evaluate(workerSession, 'chrome.scripting.getRegisteredContentScripts()')).length === 2, 'registered MAIN and ISOLATED scripts');
  const rulesets = await evaluate(workerSession, 'chrome.declarativeNetRequest.getEnabledRulesets()');
  assert.equal(rulesets.length, build.rulesets, 'All static rulesets must load');
  const rules = await evaluate(workerSession, 'chrome.declarativeNetRequest.getDynamicRules()');
  assert.ok(rules.length > 0 && rules.length <= 5000);
  console.log(`Service worker: ${rulesets.length} enabled rulesets, ${rules.length} dynamic rules`);
  const optionsTarget = await send('Target.createTarget', { url: `chrome-extension://${id}/options.html` });
  const options = await attach(optionsTarget.targetId);
  await poll(() => evaluate(options, 'document.querySelector("#static-rules")?.textContent !== "—" && document.querySelector("#enabled")?.checked'), 'dashboard state');
  assert.equal(await evaluate(options, 'Number(document.querySelector("#static-rules").textContent.replace(/[^0-9]/g,""))'), build.staticRules);
  const exportResult = await evaluate(options, 'chrome.runtime.sendMessage({type:"export-filters"})');
  assert.ok(exportResult.ok && exportResult.text.startsWith('[Adblock Plus'));
  const pageTarget = await send('Target.createTarget', { url: `http://127.0.0.1:${server.address().port}/` });
  const page = await attach(pageTarget.targetId);
  await poll(() => evaluate(page, 'document.querySelector(".adsbox")?.getAttributeNames().some(name => name.endsWith("-hide"))'), 'cosmetic content script');
  assert.equal(await evaluate(page, 'window.open("https://popads.net/smoke") === null'), true);
  assert.equal(await evaluate(page, 'window.adsbygoogle.loaded'), true);
  assert.equal(await evaluate(page, 'getComputedStyle(document.querySelector("#normal")).display'), 'block');
  await evaluate(page, 'document.querySelector("video").dispatchEvent(new Event("playing"))');
  await poll(() => evaluate(page, 'getComputedStyle(document.querySelector("#overlay")).opacity === "0"'), 'playback overlay concealment');
  assert.equal(await evaluate(page, 'getComputedStyle(document.querySelector("dialog")).opacity'), '1');
  // Real network requests use synthetic DNS and interception. Blocking must happen
  // before the interceptor; pausing must allow the same request through.
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*.doubleclick.net/*' }] }, page);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused' && message.sessionId === page) {
      send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from('fixture').toString('base64') }, page).catch(error => failures.push(error.message));
    }
  });
  const blocked = await evaluate(page, 'fetch("https://ad.doubleclick.net/adlibere-smoke").then(() => false, () => true)');
  assert.equal(blocked, true, 'Static DNR blocks the request');
  const paused = await evaluate(options, 'chrome.runtime.sendMessage({type:"set-enabled",enabled:false})');
  assert.ok(paused.ok && !paused.enabled && paused.dynamicRuleCount === 0);
  assert.deepEqual(await evaluate(workerSession, 'chrome.declarativeNetRequest.getEnabledRulesets()'), []);
  assert.deepEqual(await evaluate(workerSession, 'chrome.scripting.getRegisteredContentScripts()'), []);
  assert.equal(await evaluate(page, 'fetch("https://ad.doubleclick.net/adlibere-smoke").then(r => r.text())'), 'fixture');
  const resumed = await evaluate(options, 'chrome.runtime.sendMessage({type:"set-enabled",enabled:true})');
  assert.ok(resumed.ok && resumed.enabled && resumed.dynamicRuleCount > 0);
  assert.equal((await evaluate(workerSession, 'chrome.declarativeNetRequest.getEnabledRulesets()')).length, build.rulesets);
  // Expected ERR_BLOCKED_BY_CLIENT is the evidence for the DNR request check.
  const unexpected = failures.filter(text => !text.includes('ERR_BLOCKED_BY_CLIENT') && !text.includes('ERR_INTERNET_DISCONNECTED'));
  assert.deepEqual(unexpected, [], 'Unexpected browser runtime errors');
  console.log('PASS: worker, DNR blocking, dashboard, export, script injection, popup blocking, ad stubs, cosmetics, overlay, protected content, pause/resume.');
} catch (error) {
  console.error(logs.join('').slice(-4000));
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    send('Browser.close').catch(() => {});
    await Promise.race([browserExited, delay(5000)]);
    socket.close();
  }
  if (browser && browser.exitCode === null) {
    browser.kill();
    await Promise.race([browserExited, delay(5000)]);
  }
  server?.close();
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Browser closed')); }
  if (path.dirname(profile) !== path.resolve(tmpdir()) || !path.basename(profile).startsWith('adlibere-browser-')) throw new Error('Unsafe browser cleanup path');
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
