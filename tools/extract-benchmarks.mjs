import fs from 'node:fs';

const [, , turtlePath, satPath] = process.argv;
if (!turtlePath || !satPath) {
  console.error('usage: node tools/extract-benchmarks.mjs <d3host.txt> <adblock.js>');
  process.exit(1);
}
const read = p => fs.readFileSync(p, 'utf8');

const turtleHosts = [];
for (const line of read(turtlePath).split(/\r?\n/)) {
  const m = line.match(/^\d+\.\d+\.\d+\.\d+\s+([a-z0-9.-]+)$/);
  if (m) turtleHosts.push(m[1]);
}
const sat = read(satPath);
const start = sat.indexOf('const HOST_TESTS');
const end = sat.indexOf('const TEST_TIMEOUT_MS');
const region = sat.slice(start, end);
const satHosts = [];
for (const line of region.split(/\r?\n/)) {
  const m = line.match(/^\s*`([^`]+)`,?\s*$/);
  if (!m) continue;
  const parts = m[1].split(/\s+/).filter(h => /^[a-z0-9.-]+$/.test(h) && h.includes('.'));
  if (parts.length) satHosts.push(...parts);
}
const pathsMatch = sat.match(/const AD_PATTERN_PATHS = \[([\s\S]*?)\];/);
const pathProbes = [...pathsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

const fixture = {
  sources: [
    { name: 'adblock.turtlecute.org host list', url: 'https://adblock.turtlecute.org/d3host.txt', license: 'CC BY-NC-SA (Turtlecute Host List)' },
    { name: 'superadblocktest.com host probe list', url: 'https://superadblocktest.com/adblock.js' },
  ],
  turtlecute: { initiator: 'adblock.turtlecute.org', hosts: turtleHosts, intentionalMisses: [] },
  superadblocktest: {
    initiator: 'superadblocktest.com',
    hosts: [...new Set(satHosts)],
    pathProbes,
    intentionalMisses: [
      's.youtube.com', 'redirector.googlevideo.com', 'ssl.p.jwpcdn.com',
      'connect.facebook.net', 'tagmanager.google.com',
      'cdn.cookielaw.org', 'consent.cookiebot.com', 'consentcdn.cookiebot.com', 'cookiebot.com',
      'consent.trustarc.com', 'sdk.privacy-center.org', 'cdn.privacy-mgmt.com',
      'app.usercentrics.eu', 'cmp.usercentrics.eu', 'cmp.inmobi.com',
      'sourcepoint.mgr.consensu.org', 'cmp.osano.com', 'fundingchoicesmessages.google.com',
      'geolocation.onetrust.com', 'privacyportal.onetrust.com', 'onetrust.com',
      'widget.intercom.io', 'js.driftt.com', 'clientstream.launchdarkly.com',
      'i.instagram.com', 'widgets.pinterest.com',
    ],
  },
};
fs.writeFileSync('tests/fixtures/benchmark-hosts.json', `${JSON.stringify(fixture, null, 2)}\n`);
console.log('turtlecute', turtleHosts.length, '| sat', [...new Set(satHosts)].length, '| path probes', pathProbes.length);
