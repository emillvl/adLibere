import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './helpers.mjs';

const core = loadCore();
const ALL_DNR_TYPES = ['font', 'image', 'media', 'object', 'other', 'ping', 'script', 'stylesheet', 'sub_frame', 'websocket', 'xmlhttprequest'];

test('single-type rules redirect to local noop resources', () => {
  const rule = core.parseFilterLine('||example.com^$script', 7);
  assert.equal(rule.id, 7);
  assert.equal(rule.action.type, 'redirect');
  assert.equal(rule.action.redirect.extensionPath, '/resources/noop.js');
  assert.deepEqual(rule.condition.resourceTypes, ['script']);
  assert.equal(rule.condition.urlFilter, '||example.com^');
});

test('image, stylesheet, xhr, subdocument map to their noop resources', () => {
  assert.equal(core.parseFilterLine('||example.com^$image', 1).action.redirect.extensionPath, '/resources/1x1.gif');
  assert.equal(core.parseFilterLine('||example.com^$stylesheet', 1).action.redirect.extensionPath, '/resources/noop.css');
  assert.equal(core.parseFilterLine('||example.com^$xhr', 1).action.redirect.extensionPath, '/resources/noop.json');
  assert.equal(core.parseFilterLine('||example.com^$subdocument', 1).action.redirect.extensionPath, '/resources/noop.html');
  assert.equal(core.parseFilterLine('||example.com^$xmlhttprequest', 1).action.redirect.extensionPath, '/resources/noop.json');
});

test('untyped and multi-type rules block instead of redirect', () => {
  const untyped = core.parseFilterLine('||example.com^', 1);
  assert.equal(untyped.action.type, 'block');
  assert.deepEqual(untyped.condition.resourceTypes, ALL_DNR_TYPES);
  const multi = core.parseFilterLine('||example.com^$image,script', 1);
  assert.equal(multi.action.type, 'block');
  assert.deepEqual(multi.condition.resourceTypes, ['image', 'script']);
});

test('document and doc options produce main-frame blocks', () => {
  const document = core.parseFilterLine('||redirect.example.com^$document', 1);
  assert.equal(document.action.type, 'block');
  assert.deepEqual(document.condition.resourceTypes, ['main_frame']);
  const doc = core.parseFilterLine('||redirect.example.com^$doc', 1);
  assert.deepEqual(doc.condition.resourceTypes, ['main_frame', 'sub_frame']);
});

test('exceptions become allow rules with domain scoping', () => {
  const allow = core.parseFilterLine('@@||example.com^$script,domain=site.com|~other.com', 1);
  assert.equal(allow.action.type, 'allow');
  assert.equal(allow.priority, 10);
  assert.deepEqual(allow.condition.initiatorDomains, ['site.com']);
  assert.deepEqual(allow.condition.excludedInitiatorDomains, ['other.com']);
});

test('negated types select everything but the negated type', () => {
  const rule = core.parseFilterLine('||example.com^$~script', 1);
  assert.equal(rule.action.type, 'block');
  assert.ok(!rule.condition.resourceTypes.includes('script'));
  assert.ok(rule.condition.resourceTypes.includes('image'));
});

test('third-party and generic option noise is tolerated', () => {
  const rule = core.parseFilterLine('||example.com^$script,third-party,important,collapse,redirect=noop.js', 1);
  assert.equal(rule.action.type, 'redirect');
  assert.deepEqual(rule.condition.resourceTypes, ['script']);
});

test('unsupported options drop the rule instead of overblocking', () => {
  for (const line of [
    '||example.com^$popup',
    '||example.com^$script,badfilter',
    '||example.com^$csp=script-src none',
    '||example.com^$generichide',
    '||example.com^$header=set-cookie',
    '||example.com^$denyallow=x.com',
    '||example.com^$match-case',
    '||example.com^$first-party',
    '||example.com^$unknown-option',
  ]) {
    assert.equal(core.parseFilterLine(line, 1), null, `should skip ${line}`);
  }
});

test('cosmetic, comment, header and regex lines are skipped', () => {
  for (const line of ['! a comment', '[Adblock Plus 2.0]', 'example.com##.ad', 'example.com#@#.ad', 'example.com#?#.item:has-text(/Sponsorisé/)', 'example.com#$#abort-current-inline-script', '/^https?:\\/\\/ads\\//']) {
    assert.equal(core.parseFilterLine(line, 1), null, `should skip ${line}`);
  }
});

test('non-ascii url parts never reach urlFilter', () => {
  assert.equal(core.parseFilterLine('xn--abc.example^$script', 1) === null, false);
  for (const line of ['пример.example^$script', '||ads.пример.com^$script', 'site.com,other.com#?#.x:has-text(/Реклама/)']) {
    assert.equal(core.parseFilterLine(line, 1), null, `should skip ${line}`);
  }
});

test('plain hosts and host paths get domain anchors', () => {
  assert.equal(core.parseFilterLine('example.com', 1).condition.urlFilter, '||example.com^');
  assert.equal(core.parseFilterLine('example.com/path/file.js', 1).condition.urlFilter, '||example.com/path/file.js');
  assert.equal(core.parseFilterLine('||example.com/path/file.js', 1).condition.urlFilter, '||example.com/path/file.js');
  assert.equal(core.parseFilterLine('|https://example.com/foo.js', 1).condition.urlFilter, '|https://example.com/foo.js');
});

test('wildcard hosts and query strings survive conversion', () => {
  const wildcard = core.parseFilterLine('||ads*.example.com^$script', 1);
  assert.ok(wildcard, 'wildcard host converts');
  assert.equal(wildcard.condition.urlFilter, 'ads*.example.com^');
  const query = core.parseFilterLine('||adserver.example.com/delivery/spc.php?$script,domain=a.com', 1);
  assert.equal(query.condition.urlFilter, '||adserver.example.com/delivery/spc.php?');
  assert.deepEqual(query.condition.initiatorDomains, ['a.com']);
});

test('generic path/query rules become substring filters', () => {
  const rule = core.parseFilterLine('.php?zoneid=$script', 1);
  assert.ok(rule);
  assert.equal(rule.condition.urlFilter, '*.php?zoneid=');
  const scheme = core.parseFilterLine('://ads.$~image,domain=~legit.com', 1);
  assert.equal(scheme.condition.urlFilter, '*://ads.');
  assert.deepEqual(scheme.condition.excludedInitiatorDomains, ['legit.com']);
});

test('short path patterns require an explicit domain scope', () => {
  const scoped = core.parseFilterLine('/ad^$domain=bench.test', 1);
  assert.ok(scoped, 'scoped short pattern converts');
  assert.equal(scoped.condition.urlFilter, '*/ad^');
  assert.deepEqual(scoped.condition.initiatorDomains, ['bench.test']);
  assert.equal(core.parseFilterLine('/ad', 1), null, 'unscoped short pattern is dropped');
  assert.equal(core.parseFilterLine('/ad$script', 1), null, 'unscoped /ad is dropped');
});

test('wildcard initiator domains are dropped, not fatal', () => {
  const rule = core.parseFilterLine('||example.com^$script,domain=*.example.org|good.com', 1);
  assert.ok(rule);
  assert.deepEqual(rule.condition.initiatorDomains, ['good.com']);
});

test('rules whose domain scope is entirely wildcards are dropped, never unscoped', () => {
  assert.equal(core.parseFilterLine('@@|http$script,~3p,domain=mylink.*|my1ink.*', 1), null);
  assert.equal(core.parseFilterLine('|http$script,domain=*.wildcard-only', 1), null);
});

test('party constraints survive only on anchored patterns', () => {
  const anchored = core.parseFilterLine('||example.com^$3p', 1);
  assert.ok(anchored);
  assert.equal(anchored.action.type, 'block');
  assert.equal(core.parseFilterLine('|http*://*.*/*.$image,3p,domain=a2zupload.com', 1), null);
  assert.equal(core.parseFilterLine('*$ping,third-party', 1), null);
});

test('scoped floating allow rules keep their initiator scope', () => {
  const rule = core.parseFilterLine('@@.doubleclick.net^$domain=mcstatic.com', 1);
  assert.ok(rule);
  assert.equal(rule.action.type, 'allow');
  assert.deepEqual(rule.condition.initiatorDomains, ['mcstatic.com']);
});

test('popupPattern extracts hosts and generic patterns with allow flags', () => {
  assert.deepEqual(core.popupPattern('||popads.net^$popup'), { kind: 'host', value: 'popads.net', allow: false });
  assert.deepEqual(core.popupPattern('@@||example.com^$popup'), { kind: 'host', value: 'example.com', allow: true });
  assert.deepEqual(core.popupPattern('.com/smartpop/$popup'), { kind: 'any', value: '.com/smartpop/', allow: false });
  assert.deepEqual(core.popupPattern('&popunder=$popup,third-party'), { kind: 'any', value: '&popunder=', allow: false });
  assert.equal(core.popupPattern('||example.com^$script'), null);
  assert.equal(core.popupPattern('|javascript:*setTimeout$popup'), null);
  assert.equal(core.popupPattern('! comment'), null);
});

test('filterRules assigns sequential ids', () => {
  const rules = core.filterRules(['||a.com^$script', '! comment', '||b.com^$image']);
  assert.deepEqual(rules.map(r => r.id), [1, 2]);
});

test('converted rules never block main_frame unless a document rule asked for it', () => {
  const rules = core.filterRules(['||a.com^', '||b.com^$script', '||c.com^$document']);
  assert.ok(!rules[0].condition.resourceTypes.includes('main_frame'));
  assert.deepEqual(rules[2].condition.resourceTypes, ['main_frame']);
});
