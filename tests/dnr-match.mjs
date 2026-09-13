// Approximate DNR matching for offline tests; browser behavior needs separate checks.
const SEP = /[^a-zA-Z0-9_\-.%]/;

function tokenize(f) {
  const segments = f.split('*');
  const tokens = [];
  for (let s = 0; s < segments.length; s++) {
    const parts = segments[s].split('^');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) tokens.push({ text: parts[i] });
      if (i < parts.length - 1) tokens.push({ sep: true });
    }
    if (s < segments.length - 1) tokens.push({ wild: true });
  }
  return tokens;
}
function scanFrom(tokens, url, index) {
  for (const tok of tokens) {
    if (tok.text !== undefined) {
      const found = url.indexOf(tok.text, index);
      if (found < 0) return -1;
      index = found + tok.text.length;
    } else if (tok.sep) {
      if (index >= url.length || !SEP.test(url[index])) return -1;
      index += 1;
    }
  }
  return index;
}
export function filterMatch(filter, url) {
  let f = filter;
  let domain = false, anchoredLeft = false, anchoredRight = false;
  if (f.startsWith('||')) { domain = true; f = f.slice(2); }
  else if (f.startsWith('|')) { anchoredLeft = true; f = f.slice(1); }
  if (f.endsWith('|')) { anchoredRight = true; f = f.slice(0, -1); }
  const tokens = tokenize(f);
  if (domain) {
    const scheme = url.indexOf('://');
    if (scheme < 0) return false;
    const hostStart = scheme + 3;
    const first = tokens.find(t => t.text !== undefined);
    if (!first) return anchoredRight ? hostStart === url.length : true;
    const hostEnd = url.slice(hostStart).search(/[/:?#]/);
    const hostname = hostEnd >= 0 ? url.slice(hostStart, hostStart + hostEnd) : url.slice(hostStart);
    // A token may include a path; anchor only its hostname portion.
    const hostText = first.text.split(/[/^]/)[0];
    let pos = -1;
    for (let i = 0; i + hostText.length <= hostname.length; i++) {
      if ((i === 0 || hostname[i - 1] === '.') && hostname.startsWith(hostText, i)) { pos = i; break; }
    }
    if (pos < 0) return false;
    const final = scanFrom(tokens, url, hostStart + pos);
    if (final < 0) return false;
    return !anchoredRight || final === url.length;
  }
  const found = scanFrom(tokens, url, anchoredLeft ? 0 : 0);
  if (found < 0) return false;
  return !anchoredRight || found === url.length;
}
export function compileRules(rules) {
  const buckets = new Map();
  const domainRules = [];
  const generic = [];
  for (const rule of rules) {
    const c = rule.condition;
    const f = c.urlFilter || '';
    if (f.startsWith('||')) {
      const body = f.slice(2);
      const host = body.split(/[/^]/)[0];
      const remainder = body.slice(host.length);
      if (!host.includes('*') && !remainder) {
        (buckets.get(host) || buckets.set(host, []).get(host)).push(rule);
      } else {
        domainRules.push(rule);
      }
    } else {
      generic.push(rule);
    }
  }
  return { buckets, domainRules, generic };
}
export function classify(compiled, url, type, initiator) {
  let best = null;
  const consider = rule => {
    const c = rule.condition;
    if (c.urlFilter && !filterMatch(c.urlFilter, url)) return;
    if (c.resourceTypes && !c.resourceTypes.includes(type)) return;
    if (c.initiatorDomains) {
      const host = initiator || '';
      if (!c.initiatorDomains.some(d => host === d || host.endsWith('.' + d))) return;
    }
    if (c.excludedInitiatorDomains) {
      const host = initiator || '';
      if (c.excludedInitiatorDomains.some(d => host === d || host.endsWith('.' + d))) return;
    }
    if (!best || rule.priority > best._priority) best = rule;
  };
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  const labels = host.split('.');
  for (let i = 0; i < labels.length; i++) {
    const bucket = compiled.buckets.get(labels.slice(i).join('.'));
    if (bucket) for (const rule of bucket) consider(rule);
  }
  for (const rule of compiled.domainRules) consider(rule);
  for (const rule of compiled.generic) consider(rule);
  return best ? best.action.type : null;
}
