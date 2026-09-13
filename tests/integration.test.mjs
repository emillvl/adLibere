import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, readBuild, loadCore, loadCatalog } from './helpers.mjs';

const core = loadCore();
const catalog = loadCatalog();

test('background dynamic-rule assembly stays within quota with unique ids', () => {
  const listRules = core.filterRules(read('lists/easylist.txt').split(/\r?\n/));
  const curated = core.networkRules(catalog.networks.flatMap(n => n.rules));
  const dynamicLimit = 5000;
  const budget = Math.max(0, dynamicLimit - curated.length - 4);
  const listSlice = listRules.slice(0, budget);
  const curatedOffset = curated.map((rule, index) => ({ ...rule, id: budget + index + 1 }));
  const combined = [...listSlice, ...curatedOffset];
  assert.ok(combined.length <= dynamicLimit);
  const ids = new Set(combined.map(rule => rule.id));
  assert.equal(ids.size, combined.length, 'rule ids are unique across list and curated rules');
  for (const rule of combined) {
    assert.ok(rule.id >= 1);
    assert.ok(rule.priority >= 1);
    assert.ok(['block', 'allow', 'redirect'].includes(rule.action.type));
    if (rule.action.type === 'redirect') assert.match(rule.action.redirect.extensionPath, /^\/resources\/noop\.(js|css|html|json)$|^\/resources\/1x1\.gif$/);
  }
});

test('every redirect targets a packaged noop resource', () => {
  const resources = ['noop.js', '1x1.gif', 'noop.css', 'noop.html', 'noop.json'];
  for (const resource of resources) assert.ok(readBuild(`resources/${resource}`).length >= 0, `${resource} readable`);
  const rules = core.filterRules(read('lists/easylist.txt').split(/\r?\n/));
  const redirects = rules.filter(rule => rule.action.type === 'redirect');
  assert.ok(redirects.length > 100, 'EasyList single-type rules convert to redirects');
  for (const rule of redirects) {
    const path = rule.action.redirect.extensionPath;
    assert.ok(resources.some(resource => path === `/resources/${resource}`), `known resource ${path}`);
  }
});

test('popup allow-list wins over catalog ad domains', () => {
  const patterns = readBuild('popup-patterns.js');
  const popups = JSON.parse(patterns.slice(patterns.indexOf('{'), patterns.lastIndexOf('}') + 1));
  assert.ok(Array.isArray(popups.block.host));
  for (const network of catalog.networks) {
    for (const domain of network.domains) {
      if (popups.allow.host.includes(domain)) {
        assert.ok(!popups.block.host.includes(domain), `catalog domain ${domain} allow-listed by EasyList exception`);
      }
    }
  }
});
