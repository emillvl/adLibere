(function (root) {
  'use strict';
  const RESOURCE_TYPES = { script: 'script', image: 'image', stylesheet: 'stylesheet', subdocument: 'sub_frame', xmlhttprequest: 'xmlhttprequest' };
  const RESOURCES = { 'noop.js': ['script'], '1x1.gif': ['image'], 'noop.css': ['stylesheet'], 'noop.html': ['subdocument'], 'noop.json': ['xmlhttprequest'], 'noop.txt': ['xmlhttprequest'] };
  function hostname(input) {
    if (typeof input !== 'string' || /[\s*|,]/.test(input)) throw new Error('Enter a hostname or an http(s) URL, without wildcards.');
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Use an http(s) hostname without credentials or a port.');
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(host) || /^\d+(\.\d+){3}$/.test(host)) throw new Error('Use a full DNS hostname (for local tests use streamguard.test).');
    return host;
  }
  const matchesHost = (host, domain) => host === domain || host.endsWith(`.${domain}`);
  const patterns = host => [`*://*.${hostname(host)}/*`];
  function parseRule(line) {
    const match = /^\|\|([a-z0-9.-]+)\^\$(script|image|stylesheet|subdocument|xmlhttprequest),redirect=([a-z0-9.-]+)$/.exec(line);
    if (!match) throw new Error(`Unsupported catalog rule: ${line}`);
    const [, domain, type, resource] = match;
    if (hostname(domain) !== domain || !RESOURCES[resource]?.includes(type)) throw new Error(`Invalid resource/type: ${line}`);
    return { domain, type, resource };
  }
  function networkRules(lines, hosts) {
    const scope = hosts && hosts.length ? [...new Set(hosts.map(hostname))].sort() : undefined;
    return lines.map((line, index) => {
      const { domain, type, resource } = parseRule(line);
      const condition = { urlFilter: `||${domain}^`, resourceTypes: [RESOURCE_TYPES[type]] };
      if (scope) condition.initiatorDomains = scope;
      return { id: index + 1, priority: 10, action: { type: 'redirect', redirect: { extensionPath: `/resources/${resource}` } }, condition };
    });
  }

  const LIST_TYPES = ['script', 'image', 'stylesheet', 'xmlhttprequest', 'subdocument', 'font', 'media', 'object', 'ping', 'websocket', 'other'];
  const DNR_TYPES = { script: 'script', image: 'image', stylesheet: 'stylesheet', xmlhttprequest: 'xmlhttprequest', subdocument: 'sub_frame', font: 'font', media: 'media', object: 'object', ping: 'ping', websocket: 'websocket', other: 'other', main_frame: 'main_frame' };
  const REDIRECTS = { script: 'noop.js', image: '1x1.gif', stylesheet: 'noop.css', sub_frame: 'noop.html', xmlhttprequest: 'noop.json' };
  const TYPE_OPTIONS = new Set(['script', 'image', 'stylesheet', 'xmlhttprequest', 'xhr', 'subdocument', 'font', 'media', 'object', 'ping', 'beacon', 'websocket', 'other', 'all', 'document', 'doc']);
  // Drop rules with unsupported restrictions to avoid broadening their scope.
  const UNSUPPORTED_OPTIONS = new Set(['popup', 'csp', 'elemhide', 'generichide', 'genericblock', 'specifichide', 'badfilter', 'match-case', 'denyallow', 'inline-script', 'inline-font', 'header', 'permissions', 'dnsrewrite', 'replace']);
  const VALID_DOMAIN = /^[a-z0-9.-]+$/i;

  function splitOptions(line) {
    const dollar = line.lastIndexOf('$');
    if (dollar <= 0) return [line, ''];
    const options = line.slice(dollar + 1);
    if (!/^[a-z0-9~=|,.*-]+$/i.test(options)) return [line, ''];
    return [line.slice(0, dollar), options];
  }
  function conditionForUrl(urlPart) {
    if (!urlPart || /\s/.test(urlPart) || /[^\x00-\x7F]/.test(urlPart)) return null;
    if (/^\**$/.test(urlPart)) return null;
    let filter = null;
    let anchored = true;
    if (urlPart.startsWith('||')) {
      const body = urlPart.slice(2).replace(/^https?:\/\//, '');
      const host = body.split(/[/^]/)[0];
      if (!host || host === '*' || !/^[a-z0-9.*-]+$/i.test(host) || (!host.includes('.') && !host.includes('*'))) return null;
      const remainder = body.slice(host.length);
      const combined = !remainder ? `${host}^`
        : remainder.startsWith('/') || remainder.startsWith('^') ? `${host}${remainder}`
          : `${host}^${remainder}`;
      if (host.includes('*')) { filter = combined; anchored = false; }
      else filter = `||${combined}`;
    } else if (urlPart.startsWith('|http')) {
      filter = urlPart;
      anchored = !urlPart.includes('*');
    } else {
      const host = urlPart.split(/[/^]/)[0];
      if (!host || !/^[a-z0-9.*-]+$/i.test(host)) {
        if (urlPart.length < 2) return null;
        filter = urlPart.startsWith('*') ? urlPart : `*${urlPart}`;
        anchored = false;
      } else {
        if (host === '*') return null;
        const remainder = urlPart.slice(host.length);
        const combined = !remainder ? `${host}^`
          : remainder.startsWith('/') || remainder.startsWith('^') ? `${host}${remainder}`
            : `${host}^${remainder}`;
        if (host.includes('*')) { filter = combined; anchored = false; }
        else filter = `||${combined}`;
      }
    }
    if (/[|^]\*|\*[|^]/.test(filter)) return null;
    return { urlFilter: filter, anchored };
  }
  function parseFilterLine(line, id) {
    let source = String(line).trim();
    if (!source || source.startsWith('!') || source.startsWith('[')) return null;
    if (source.includes('#')) return null;
    let allow = false;
    if (source.startsWith('@@')) { allow = true; source = source.slice(2); }
    if (source.startsWith('/') && source.endsWith('/') && source.length > 2) return null;
    const [urlPart, optionsPart] = splitOptions(source);
    const condition = conditionForUrl(urlPart);
    if (!condition) return null;
    const optionEntries = optionsPart ? optionsPart.split(',') : [];
    const types = new Set();
    let excludedTypes = null;
    const initiatorDomains = [];
    const excludedInitiatorDomains = [];
    let domainSeen = false;
    let domainKept = false;
    let exclusionKept = false;
    let partySeen = false;
    for (const raw of optionEntries) {
      const [name, value = ''] = raw.split('=');
      const negated = name.startsWith('~');
      const option = (negated ? name.slice(1) : name).toLowerCase();
      if (UNSUPPORTED_OPTIONS.has(option) || option === 'first-party') return null;
      if (option === 'third-party' || option === '1p' || option === '3p' || option === 'strict1p' || option === 'strict3p') { partySeen = true; if (negated) return null; continue; }
      if (option === 'important' || option === 'collapse' || option === 'empty' || option === 'redirect' || option === 'redirect-rule' || option === 'method' || option === 'from' || option === 'to' || option === 'removeparam' || option === 'extension') continue;
      if (option === 'domain') {
        domainSeen = true;
        for (const part of value.split('|')) {
          if (!part) continue;
          const clean = part.replace(/^~/, '');
          if (!VALID_DOMAIN.test(clean)) continue;
          (part.startsWith('~') ? excludedInitiatorDomains : initiatorDomains).push(clean);
          if (part.startsWith('~')) exclusionKept = true; else domainKept = true;
        }
        continue;
      }
      if (TYPE_OPTIONS.has(option)) {
        if (option === 'all') { LIST_TYPES.forEach(type => types.add(type)); continue; }
        if (option === 'document') { if (!negated) types.add('main_frame'); else { excludedTypes = excludedTypes || new Set(LIST_TYPES); excludedTypes.delete('main_frame'); } continue; }
        if (option === 'doc') {
          if (negated) { excludedTypes = excludedTypes || new Set(LIST_TYPES); excludedTypes.delete('main_frame'); excludedTypes.delete('subdocument'); types.delete('main_frame'); types.delete('subdocument'); }
          else { types.add('main_frame'); types.add('subdocument'); }
          continue;
        }
        const type = option === 'xhr' ? 'xmlhttprequest' : option === 'beacon' ? 'ping' : option;
        if (negated) { excludedTypes = excludedTypes || new Set(LIST_TYPES); excludedTypes.delete(type); types.delete(type); }
        else { types.add(type); }
        continue;
      }
      return null;
    }
    // Reject rules whose entire domain scope was discarded.
    if (domainSeen && !domainKept && !exclusionKept) return null;
    if (partySeen && !condition.anchored) return null;
    if (!condition.anchored && urlPart.length < 4 && !initiatorDomains.length && !excludedInitiatorDomains.length) return null;
    let resourceTypes = [...types];
    if (excludedTypes && !types.size) resourceTypes = [...excludedTypes];
    if (!resourceTypes.length) resourceTypes = LIST_TYPES.slice();
    let mapped = [...new Set(resourceTypes.map(type => DNR_TYPES[type]))].sort();
    // Unanchored patterns must not apply to whole-page navigations.
    if (!condition.anchored) mapped = mapped.filter(type => type !== 'main_frame');
    if (!allow && mapped.includes('main_frame') && !condition.anchored) return null;
    if (!mapped.length) return null;
    const redirectType = mapped.find(type => REDIRECTS[type]);
    const action = allow
      ? { type: 'allow' }
      : redirectType && mapped.length === 1
        ? { type: 'redirect', redirect: { extensionPath: `/resources/${REDIRECTS[redirectType]}` } }
        : { type: 'block' };
    if (initiatorDomains.length) condition.initiatorDomains = initiatorDomains;
    if (excludedInitiatorDomains.length) condition.excludedInitiatorDomains = excludedInitiatorDomains;
    const { anchored, ...dirtyCondition } = condition;
    return { id, priority: allow ? 10 : 1, action, condition: { ...dirtyCondition, resourceTypes: mapped } };
  }
  function filterRules(lines, startId = 1) {
    const rules = [];
    let id = startId;
    for (const line of lines) {
      const rule = parseFilterLine(line, id);
      if (rule) { rules.push(rule); id += 1; }
    }
    return rules;
  }
  // Extract $popup patterns for the page guard; @@ entries become exceptions.
  function popupPattern(line) {
    let source = String(line).trim();
    if (!source || source.startsWith('!') || source.startsWith('[') || source.includes('#')) return null;
    let allow = false;
    if (source.startsWith('@@')) { allow = true; source = source.slice(2); }
    const [urlPart, optionsPart] = splitOptions(source);
    if (!optionsPart.split(',').some(option => option === 'popup')) return null;
    if (urlPart.startsWith('||')) {
      const host = urlPart.slice(2).split(/[/^]/)[0].toLowerCase();
      if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.')) return null;
      return { kind: 'host', value: host, allow };
    }
    const value = urlPart.replace(/^\|/, '').replace(/\^$/, '').replace(/\|$/, '');
    if (!value || /\s/.test(value)) return null;
    if (/[\\|^]/.test(value) || /[(){}]/.test(value)) return null;
    if (/^(blob|about|data|javascript):/i.test(value)) return null;
    if (/^https?[:*]/i.test(value)) return null;
    if (!/[a-z]/i.test(value.replace(/\*/g, ''))) return null;
    if (value.replace(/\*/g, '').length < 4) return null;
    return { kind: 'any', value, allow };
  }

  function overlayDecision({ rect, videoRect, viewport, style, related, recent, protectedElement }) {
    if (!recent || related || protectedElement || !['fixed', 'absolute'].includes(style.position) || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (rect.width < 160 || rect.height < 90 || videoRect.width < 120 || videoRect.height < 70) return false;
    const intersection = Math.max(0, Math.min(rect.right, videoRect.right) - Math.max(rect.left, videoRect.left)) * Math.max(0, Math.min(rect.bottom, videoRect.bottom) - Math.max(rect.top, videoRect.top));
    const coverage = intersection / (videoRect.width * videoRect.height);
    const viewportCoverage = Math.max(0, Math.min(rect.right, viewport.width) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0)) / (viewport.width * viewport.height);
    const z = Number.parseInt(style.zIndex, 10) || 0;
    return coverage >= 0.65 && (z >= 1000 || (viewportCoverage >= 0.85 && z >= 10));
  }
  function subscription(data, hosts = []) {
    const lines = ['[Adblock Plus 2.0]', `! Title: ${data.name}`, `! Version: ${data.version}`, '! Expires: 7 days', '! Generated from src/catalog.js.', '! Requires uBlock Origin redirect resources and scriptlets.', '! Companion lists (subscribe separately):', ...data.upstreams.map(x => `! ${x.name}: ${x.url}`), ''];
    for (const network of data.networks) lines.push(`! ${network.id} — ${network.evidence.status}; reviewed ${network.reviewed}`, ...network.rules, '');
    for (const site of data.sites) {
      lines.push(`! ${site.id} — ${site.evidence.status}; ${site.evidence.summary}`);
      for (const domain of site.domains) {
        for (const selector of site.cosmetics) lines.push(`${domain}##${selector}`);
        for (const scriptlet of site.scriptlets) lines.push(`${domain}##+js(${scriptlet})`);
      }
    }
    const adPattern = data.networks.flatMap(x => x.domains).map(x => x.replace(/\./g, '\\.')).join('|');
    if (hosts.length) {
      for (const host of [...new Set(hosts.map(hostname))].sort()) {
        lines.push('', `! User enabled site: ${host}`, `${host}##+js(no-window-open-if, /${adPattern}/)`, `${host}##+js(popads-dummy)`);
        lines.push(`||googlesyndication.com/pagead/js/adsbygoogle.js$script,redirect=googlesyndication_adsbygoogle.js,domain=${host}`, `||securepubads.g.doubleclick.net/tag/js/gpt.js$script,redirect=googletagservices_gpt.js,domain=${host}`);
      }
    }
    return `${lines.join('\n')}\n`;
  }
  root.StreamGuardCore = Object.freeze({ hostname, matchesHost, patterns, parseRule, networkRules, parseFilterLine, filterRules, popupPattern, overlayDecision, subscription, LIST_TYPES });
})(globalThis);
