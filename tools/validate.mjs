import assert from 'node:assert/strict';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export function filesIn(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const file = path.join(directory, name);
    const stat = lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), `Symlink is not allowed: ${file}`);
    assert.ok(stat.isFile() || stat.isDirectory(), `Not a regular file: ${file}`);
    return stat.isDirectory() ? filesIn(file, `${prefix}${name}/`) : [`${prefix}${name}`];
  });
}

// Validate either the build directory or an independently extracted archive.
export function validateDistribution(directory) {
  const files = filesIn(directory);
  const read = file => readFileSync(path.join(directory, file), 'utf8');
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3, 'Manifest V3 required');
  assert.match(manifest.version, /^\d+(?:\.\d+){0,3}$/);
  const parts = manifest.version.split('.').map(Number);
  assert.ok(parts.some(Boolean) && parts.every(n => n <= 65535), 'Invalid Chromium version');
  assert.ok(manifest.description.length <= 132, 'Description exceeds Chromium limit');
  assert.ok(Number(manifest.minimum_chrome_version) >= 121);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'");
  assert.deepEqual(manifest.permissions.slice().sort(), ['alarms', 'declarativeNetRequest', 'scripting', 'storage', 'unlimitedStorage']);
  assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
  assert.ok(!manifest.update_url && !manifest.externally_connectable);
  const sets = manifest.declarative_net_request.rule_resources;
  assert.ok(sets.length > 0 && sets.length <= 100);
  assert.ok(sets.filter(set => set.enabled).length <= 50);
  assert.equal(new Set(sets.map(set => set.id)).size, sets.length);
  const expected = [
    'manifest.json', 'background.js', 'core.js', 'catalog.js', 'build-info.js',
    'popup-patterns.js', 'main.bundle.js', 'content.bundle.js',
    'options.html', 'options.js', 'options.css', 'icons/adlibere.png',
    'resources/noop.js', 'resources/noop.css', 'resources/noop.html',
    'resources/noop.json', 'resources/noop.txt', 'resources/1x1.gif',
    'LICENSE', 'THIRD_PARTY.md', 'licenses/GPL-3.0.txt', 'filter-sources.json', ...sets.map(set => set.path),
  ].sort();
  assert.deepEqual(files, expected, 'Missing runtime asset or unexpected development/private file');
  function reference(file) {
    assert.ok(typeof file === 'string' && !file.startsWith('/') && !file.includes('\\') && !file.split('/').includes('..'), `Unsafe reference: ${file}`);
    assert.ok(files.includes(file), `Missing resource: ${file}`);
  }
  [manifest.background.service_worker, manifest.options_ui.page,
    ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
    ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])]),
    ...sets.map(set => set.path)].forEach(reference);
  for (const entry of manifest.web_accessible_resources) {
    for (const resource of entry.resources) {
      if (resource.endsWith('/*')) assert.ok(files.some(file => file.startsWith(resource.slice(0, -1))));
      else reference(resource);
    }
  }
  for (const file of files.filter(file => file.endsWith('.html'))) {
    for (const [, resource] of read(file).matchAll(/(?:src|href)="([^"]+)"/g)) reference(resource);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(read(file)), 'Inline executable script forbidden');
  }
  for (const file of files.filter(file => file.endsWith('.js'))) new vm.Script(read(file), { filename: file });
  const background = read(manifest.background.service_worker);
  for (const [, imports] of background.matchAll(/importScripts\(([^)]+)\)/g)) {
    for (const [, resource] of imports.matchAll(/['"]([^'"]+)['"]/g)) reference(resource);
  }
  for (const [, scripts] of background.matchAll(/\bjs:\s*\[([^\]]+)\]/g)) {
    for (const [, resource] of scripts.matchAll(/['"]([^'"]+)['"]/g)) reference(resource);
  }
  const context = vm.createContext({});
  vm.runInContext(read('build-info.js'), context);
  const build = context.StreamGuardBuild;
  assert.equal(build.version, manifest.version);
  assert.deepEqual(Array.from(build.rulesetIds), sets.map(set => set.id));
  const types = new Set(['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other']);
  let count = 0;
  for (const set of sets) {
    const rules = JSON.parse(read(set.path));
    assert.ok(rules.length > 0 && rules.length <= 25000);
    assert.equal(rules.length, build.rulesets.find(item => item.id === set.id)?.count);
    const ids = new Set();
    for (const rule of rules) {
      assert.ok(Number.isSafeInteger(rule.id) && rule.id > 0 && !ids.has(rule.id), `Invalid rule ID in ${set.path}`);
      ids.add(rule.id);
      assert.ok(Number.isSafeInteger(rule.priority) && rule.priority >= 1);
      assert.ok(['allow', 'block'].includes(rule.action.type));
      assert.match(rule.condition.urlFilter, /^[\x00-\x7f]+$/);
      assert.ok(rule.condition.resourceTypes.length > 0 && rule.condition.resourceTypes.every(type => types.has(type)));
      if (rule.condition.domainType) assert.ok(['firstParty', 'thirdParty'].includes(rule.condition.domainType));
      for (const key of ['initiatorDomains', 'excludedInitiatorDomains']) {
        for (const domain of rule.condition[key] || []) assert.match(domain, /^[a-z0-9.-]+$/i);
      }
    }
    count += rules.length;
  }
  assert.equal(count, build.staticRuleCount);
  assert.ok(count <= 250000, 'Project static-rule budget exceeded');
  const icon = readFileSync(path.join(directory, 'icons/adlibere.png'));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.ok(icon.readUInt32BE(16) >= 128 && icon.readUInt32BE(20) >= 128);
  return { version: manifest.version, files, staticRules: count, rulesets: sets.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateDistribution(path.resolve(process.argv[2] || 'dist'));
  console.log(`Validated adLibere ${result.version}: ${result.files.length} files, ${result.staticRules} rules, ${result.rulesets} rulesets`);
}
