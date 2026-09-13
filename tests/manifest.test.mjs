import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuild, loadBuildInfo } from './helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const manifest = JSON.parse(readBuild('manifest.json'));
const ruleResources = manifest.declarative_net_request.rule_resources;
const build = loadBuildInfo();

test('manifest is MV3 with automatic-everywhere permissions', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'adLibere');
  assert.ok(manifest.permissions.includes('declarativeNetRequest'), 'full DNR permission: no per-site grants needed');
  assert.ok(!manifest.permissions.includes('declarativeNetRequestWithHostAccess'), 'must not require per-site host access');
  assert.ok(manifest.host_permissions.includes('<all_urls>'), 'content scripts protect every site automatically');
  assert.ok(manifest.permissions.includes('alarms'), 'self-updating lists');
  assert.ok(manifest.permissions.includes('unlimitedStorage'), 'room for refreshed rule storage');
  assert.ok(Number.parseInt(manifest.minimum_chrome_version, 10) >= 120);
});

test('every manifest-referenced file exists', () => {
  const files = [
    manifest.background.service_worker,
    manifest.options_ui.page,
    ...ruleResources.map(set => set.path),
    ...Object.values(manifest.icons),
    ...manifest.web_accessible_resources.flatMap(entry => entry.resources.map(resource => resource.replace('/*', '/noop.js'))),
  ];
  for (const file of files) assert.ok(existsSync(path.join(root, file)), `missing ${file}`);
});

test('DNR ruleset ids match the build output', () => {
  assert.deepEqual(ruleResources.map(set => set.id), build.rulesetIds);
  for (const set of ruleResources) assert.equal(set.enabled, true, `${set.id} enabled by default`);
});

test('noop redirect resources exist for every redirect action', () => {
  const resources = ['noop.js', '1x1.gif', 'noop.css', 'noop.html', 'noop.json', 'noop.txt'];
  for (const resource of resources) assert.ok(existsSync(path.join(root, 'resources', resource)), `missing resources/${resource}`);
  const war = manifest.web_accessible_resources[0];
  assert.ok(war.resources.includes('resources/*'));
  assert.ok(war.matches.includes('<all_urls>'));
});

test('bundles exist with expected layers', () => {
  const main = readBuild('main.bundle.js');
  const content = readBuild('content.bundle.js');
  for (const bundle of [main, content]) {
    assert.ok(bundle.includes('StreamGuardCore'));
    assert.ok(bundle.includes('StreamGuardCatalog'));
    assert.ok(bundle.includes('StreamGuardBuild'));
  }
  assert.ok(main.includes('StreamGuardPopups'), 'popup guard patterns bundled for MAIN world');
  assert.ok(!content.includes('StreamGuardPopups'));
  assert.ok(existsSync(path.join(root, 'popup-patterns.js')));
});

test('background loads the same shared layers', () => {
  const background = readBuild('background.js');
  for (const layer of ['core.js', 'catalog.js', 'build-info.js']) {
    assert.ok(background.includes(`'${layer}'`), `background imports ${layer}`);
  }
  assert.ok(background.includes("matches: ['<all_urls>']"), 'content scripts registered for every site');
});
