import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, loadCatalog } from './helpers.mjs';

const core = loadCore();
const catalog = loadCatalog();

test('hostname normalizes URLs and lowercases', () => {
  assert.equal(core.hostname('example.com'), 'example.com');
  assert.equal(core.hostname('https://EXAMPLE.com./path?q=1'), 'example.com');
  assert.equal(core.hostname('http://sub.example.com'), 'sub.example.com');
});

test('hostname rejects junk input', () => {
  for (const input of ['*.example.com', 'foo bar.com', 'localhost', '127.0.0.1', 'https://u:p@example.com', 'https://example.com:8443', '', null]) {
    assert.throws(() => core.hostname(input), undefined, `should reject ${JSON.stringify(input)}`);
  }
});

test('matchesHost covers subdomains but not lookalikes', () => {
  assert.ok(core.matchesHost('a.b.example.com', 'example.com'));
  assert.ok(core.matchesHost('example.com', 'example.com'));
  assert.ok(!core.matchesHost('notexample.com', 'example.com'));
  assert.ok(!core.matchesHost('example.com.evil.net', 'example.com'));
});

test('patterns produces wildcard origin patterns', () => {
  assert.deepEqual(core.patterns('example.com'), ['*://*.example.com/*']);
});

test('parseRule accepts catalog network lines', () => {
  const rule = core.parseRule('||adsterra.com^$script,redirect=noop.js');
  assert.deepEqual(rule, { domain: 'adsterra.com', type: 'script', resource: 'noop.js' });
});

test('parseRule rejects bad catalog lines', () => {
  for (const line of ['||x.com^$script,redirect=nope.js', '||x.com^$video,redirect=noop.js', 'x.com^$script,redirect=noop.js', '||x.com^$script,redirect=noop.js,extra']) {
    assert.throws(() => core.parseRule(line), undefined, `should reject ${line}`);
  }
});

test('networkRules are global when no hosts are given', () => {
  const rules = core.networkRules(catalog.networks.flatMap(n => n.rules));
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.ok(!rule.condition.initiatorDomains, 'no initiator scope');
    assert.equal(rule.priority, 10);
    assert.equal(rule.action.type, 'redirect');
    assert.match(rule.action.redirect.extensionPath, /^\/resources\//);
    assert.ok(rule.condition.urlFilter.startsWith('||'));
  }
});

test('networkRules are scoped to enabled hosts when provided', () => {
  const rules = core.networkRules(catalog.networks.flatMap(n => n.rules), ['sub.example.com', 'example.com']);
  assert.ok(rules.length > 0);
  for (const rule of rules) assert.deepEqual(rule.condition.initiatorDomains, ['example.com', 'sub.example.com']);
});

test('overlayDecision conceals high-z full-coverage overlays during playback', () => {
  const base = { rect: { left: 50, top: 50, right: 750, bottom: 650, width: 700, height: 600 }, videoRect: { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }, viewport: { width: 800, height: 600 }, recent: true, related: false, protectedElement: false };
  assert.ok(core.overlayDecision({ ...base, style: { position: 'fixed', zIndex: '2000' } }));
  assert.ok(core.overlayDecision({ ...base, rect: { left: 0, top: 0, right: 800, bottom: 600 }, style: { position: 'fixed', zIndex: '50' } }), 'viewport-filling overlay needs only z>=10');
});

test('overlayDecision spares static, hidden, small, stale and protected elements', () => {
  const base = { rect: { left: 50, top: 50, right: 750, bottom: 650, width: 700, height: 600 }, videoRect: { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }, viewport: { width: 800, height: 600 }, recent: true, related: false, protectedElement: false };
  const styled = { ...base, style: { position: 'fixed', zIndex: '2000' } };
  assert.ok(!core.overlayDecision({ ...styled, style: { position: 'static', zIndex: '2000' } }));
  assert.ok(!core.overlayDecision({ ...styled, style: { position: 'fixed', display: 'none' } }));
  assert.ok(!core.overlayDecision({ ...styled, rect: { left: 0, top: 0, right: 100, bottom: 60 } }));
  assert.ok(!core.overlayDecision({ ...styled, recent: false }));
  assert.ok(!core.overlayDecision({ ...styled, protectedElement: true }));
  assert.ok(!core.overlayDecision({ ...styled, related: true }));
});

test('subscription exports catalog rules and optional user hosts', () => {
  const text = core.subscription(catalog);
  assert.ok(text.startsWith('[Adblock Plus 2.0]'));
  assert.ok(text.includes('! Title: adLibere'));
  assert.ok(text.includes('||adsterra.com^$script,redirect=noop.js'));
  assert.ok(text.includes('! EasyList: https://easylist.to/easylist/easylist.txt'));
  assert.ok(!text.includes('User enabled site'));
  const withHost = core.subscription(catalog, ['example.com']);
  assert.ok(withHost.includes('User enabled site: example.com'));
  assert.ok(withHost.includes('example.com##+js(popads-dummy)'));
});

test('catalog lists popunder guard networks', () => {
  const popunder = catalog.networks.find(n => n.id === 'popunder-guard');
  assert.ok(popunder, 'popunder-guard entry exists');
  assert.ok(popunder.domains.includes('popads.net'));
  for (const network of catalog.networks) {
    for (const rule of network.rules) {
      assert.doesNotThrow(() => core.parseRule(rule), undefined, `valid catalog rule: ${rule}`);
    }
  }
});
