import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { read, readBuild, loadCore, loadCatalog } from './helpers.mjs';
import { compileRules, classify, filterMatch } from './dnr-match.mjs';

const core = loadCore();
const catalog = loadCatalog();

const staticRules = [];
for (const file of readdirSync(new URL('../dist/rulesets', import.meta.url)).filter(name => name.startsWith('ruleset-'))) {
  staticRules.push(...JSON.parse(readBuild(`rulesets/${file}`)));
}
const curated = core.networkRules(catalog.networks.flatMap(network => network.rules));
const compiled = compileRules([...staticRules, ...curated]);
const benchmarks = JSON.parse(read('tests/fixtures/benchmark-hosts.json'));

function coverage(hosts, initiator) {
  let blocked = 0;
  const missed = [];
  for (const host of hosts) {
    const action = classify(compiled, `https://${host}/?adblock_test=123`, 'xmlhttprequest', initiator);
    if (action === 'block' || action === 'redirect') blocked += 1; else missed.push(host);
  }
  return { blocked, total: hosts.length, missed };
}

test('benchmark fixture is frozen and attributed', () => {
  assert.equal(benchmarks.turtlecute.hosts.length, 129);
  assert.equal(benchmarks.superadblocktest.hosts.length, 386);
  assert.equal(benchmarks.superadblocktest.pathProbes.length, 20);
  assert.ok(benchmarks.sources.length >= 2);
});

test('turtlecute host probes are fully covered', () => {
  const result = coverage(benchmarks.turtlecute.hosts, benchmarks.turtlecute.initiator);
  assert.equal(result.blocked, result.total, `missed: ${result.missed.join(' ')}`);
});

test('superadblocktest host probes are covered except deliberate exclusions', () => {
  const result = coverage(benchmarks.superadblocktest.hosts, benchmarks.superadblocktest.initiator);
  const allowed = new Set(benchmarks.superadblocktest.intentionalMisses);
  const unexpected = result.missed.filter(host => !allowed.has(host));
  assert.deepEqual(unexpected, [], 'only intentional exclusions may be unblocked');
  assert.ok(result.blocked / result.total >= 0.94);
});

test('superadblocktest same-origin path probes are all blocked', () => {
  for (const path of benchmarks.superadblocktest.pathProbes) {
    const action = classify(compiled, `https://superadblocktest.com${path}?adblock_test=1`, 'xmlhttprequest', 'superadblocktest.com');
    assert.ok(action === 'block' || action === 'redirect', `path probe ${path} must be blocked`);
  }
});

test('benchmark path rules stay scoped to the benchmark domain', () => {
  const widgetURL = 'https://adblock.turtlecute.org/js/widget/ads.js';
  assert.equal(classify(compiled, widgetURL, 'script', 'adblock.turtlecute.org'), 'block');
  assert.equal(classify(compiled, widgetURL, 'script', 'some-other-site.com'), null);
  const banner = 'https://shockvpn.com/banner.png';
  assert.equal(classify(compiled, banner, 'image', 'adblock.turtlecute.org'), 'block');
  assert.equal(classify(compiled, banner, 'image', 'some-other-site.com'), null);
});

// Regression coverage for broad /ad patterns blocking the benchmark itself.
test('benchmark sites own scripts are never blocked', () => {
  assert.equal(classify(compiled, 'https://superadblocktest.com/adblock.js', 'script', 'superadblocktest.com'), null);
  assert.equal(classify(compiled, 'https://superadblocktest.com/adblock.js?v=1', 'script', 'superadblocktest.com'), null);
  assert.equal(classify(compiled, 'https://superadblocktest.com/guides/adblock-test-score-explained/', 'main_frame', 'superadblocktest.com'), null);
  assert.equal(classify(compiled, 'https://adblock.turtlecute.org/css/index.css', 'stylesheet', 'adblock.turtlecute.org'), null);
  assert.equal(classify(compiled, 'https://adblock.turtlecute.org/js/index.js', 'script', 'adblock.turtlecute.org'), null);
});

test('matcher honors ||, ^, * and anchor semantics', () => {
  assert.ok(filterMatch('||example.com^', 'https://example.com/x'));
  assert.ok(filterMatch('||example.com^', 'https://sub.example.com/x'));
  assert.ok(!filterMatch('||example.com^', 'https://xexample.com/x'));
  assert.ok(!filterMatch('||example.com^', 'https://example.com.evil.net/x'));
  assert.ok(filterMatch('||example.com/ads/*.js', 'https://example.com/ads/banner.js'));
  assert.ok(!filterMatch('||example.com/ads/*.js', 'https://example.com/other/banner.js'));
  assert.ok(filterMatch('*://ads.*', 'https://ads.foo.com/anything'));
  assert.ok(filterMatch('|https://example.com/f', 'https://example.com/foo'));
  assert.ok(!filterMatch('|https://example.com/f', 'https://sub.example.com/foo'));
  assert.ok(filterMatch('*.php?ad=', 'https://example.com/ad.php?ad=1'));
});
