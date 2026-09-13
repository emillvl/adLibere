import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSource, readBuild, loadBuildInfo, loadPopups } from './helpers.mjs';

const build = loadBuildInfo();
const ALLOWED_ACTIONS = new Set(['block', 'allow']);
const KNOWN_TYPES = new Set(['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other']);

test('static rulesets are well-formed and meaningful', () => {
  assert.ok(build.staticRuleCount > 30000, `expected a real EasyList build, got ${build.staticRuleCount}`);
  let total = 0;
  for (const set of build.rulesets) {
    const rules = JSON.parse(readBuild(set.path));
    assert.equal(rules.length, set.count);
    const ids = new Set();
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      assert.equal(rule.id, index + 1, 'sequential ids restarting per ruleset');
      assert.ok(!ids.has(rule.id));
      ids.add(rule.id);
      assert.ok(rule.priority >= 1);
      assert.ok(ALLOWED_ACTIONS.has(rule.action.type), `no redirect in static rules: ${rule.action.type}`);
      assert.equal(typeof rule.condition.urlFilter, 'string');
      assert.ok(rule.condition.urlFilter.length > 0);
      assert.ok(/^[\x00-\x7F]*$/.test(rule.condition.urlFilter), `ascii-only urlFilter: ${rule.condition.urlFilter}`);
      assert.ok(Array.isArray(rule.condition.resourceTypes) && rule.condition.resourceTypes.length > 0);
      for (const type of rule.condition.resourceTypes) assert.ok(KNOWN_TYPES.has(type), `known resourceType ${type}`);
      assert.ok(rule.action.type !== 'block' || !rule.condition.resourceTypes.includes('main_frame') || rule.condition.urlFilter.startsWith('||'), 'main_frame blocks stay domain-anchored');
    }
    total += rules.length;
  }
  assert.equal(total, build.staticRuleCount);
});

test('bundles are freshly built from sources', () => {
  const shared = readSource('core.js') + readSource('catalog.js') + readBuild('build-info.js');
  assert.equal(readBuild('main.bundle.js'), shared + readBuild('popup-patterns.js') + readSource('main.js'));
  assert.equal(readBuild('content.bundle.js'), shared + readSource('content.js'));
});

test('popup guard ships host and generic patterns with allow-list', () => {
  const patterns = loadPopups();
  assert.ok(patterns.block.host.length > 1000, 'thousands of popup hosts extracted');
  assert.ok(patterns.block.host.includes('popads.net'));
  assert.ok(patterns.block.any.length > 0);
  assert.ok(patterns.allow.host.length > 0, 'popup exceptions extracted');
  for (const value of patterns.block.host) assert.ok(!patterns.allow.host.includes(value), 'no allow-listed hosts left in the block list');
});

test('catalog network rules and EasyList share the parser', () => {
  const catalog = readSource('catalog.js');
  assert.ok(catalog.includes('popunder-guard'));
  const core = readSource('core.js');
  assert.ok(core.includes('parseFilterLine'));
  assert.ok(core.includes('popupPattern'));
});
