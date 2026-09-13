(() => {
  'use strict';
  const MARKER_PREFIX = '__sgl_';
  if (Object.getOwnPropertyNames(globalThis).some(name => name.startsWith(MARKER_PREFIX))) return;
  Object.defineProperty(globalThis, `${MARKER_PREFIX}${Math.random().toString(36).slice(2)}`, { value: true });
  const core = globalThis.StreamGuardCore;
  const data = globalThis.StreamGuardCatalog;
  const host = location.hostname;
  const sites = data.sites.filter(site => site.domains.some(domain => core.matchesHost(host, domain)));
  const noop = () => {};
  const nativeMicrotask = globalThis.queueMicrotask.bind(globalThis);
  const wrap = fn => new Proxy(fn, {
    apply: (target, thisArg, args) => Reflect.apply(target, thisArg, args),
    construct: (target, args) => Reflect.construct(target, args)
  });

  function queue(execute = false) {
    const array = [];
    Object.defineProperty(array, 'push', { value: (...items) => {
      if (execute) for (const item of items) if (typeof item === 'function') nativeMicrotask(() => { try { item(); } catch { /* Ignore failed ad callbacks. */ } });
      return 1; // Discard queued ad payloads.
    } });
    return array;
  }
  function pin(name, value, accept) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    if (previous && !previous.configurable) return;
    if (previous && 'value' in previous) accept?.(previous.value);
    Object.defineProperty(globalThis, name, { configurable: true, enumerable: true, get: () => value, set: next => { if (next !== value) accept?.(next); } });
  }
  const ads = queue();
  ads.loaded = true;
  pin('adsbygoogle', ads);
  const commands = queue(true);
  function chain(methods) {
    const object = {};
    for (const method of methods) object[method] = () => object;
    return object;
  }
  const pubads = chain(['addEventListener', 'removeEventListener', 'setTargeting', 'clearTargeting', 'enableSingleRequest', 'collapseEmptyDivs', 'disableInitialLoad', 'setPrivacySettings', 'setPublisherProvidedId', 'setCentering', 'refresh', 'enableVideoAds', 'setRequestNonPersonalizedAds', 'setForceSafeFrame', 'setSafeFrameConfig']);
  pubads.getSlots = () => [];
  pubads.getTargeting = () => [];
  const slot = () => chain(['addService', 'setTargeting', 'clearTargeting', 'setCollapseEmptyDiv', 'setCategoryExclusion', 'setClickUrl', 'setSafeFrameConfig', 'setForceSafeFrame', 'defineSizeMapping']);
  const gpt = { cmd: commands, apiReady: true, pubadsReady: true, pubads: () => pubads, defineSlot: slot, defineOutOfPageSlot: slot, display: noop, enableServices: noop, destroySlots: () => true, setConfig: noop, getVersion: () => 'stream-guard-stub', sizeMapping: () => { const mapping = chain(['addSize']); mapping.build = () => []; return mapping; } };
  pin('googletag', gpt, value => { if (Array.isArray(value?.cmd)) commands.push(...value.cmd.filter(x => typeof x === 'function')); });
  for (const { name, profile } of data.networks.flatMap(network => network.globals)) pin(name, profile === 'queue' ? queue() : Object.create(null));

  const BAIT = /(^|[-_#\s])(ad|ads|advert|advertisement|advertising|sponsor|sponsored|banner|bannerad|google_ad|adsbygoogle|adslot|adsense|doubleclick|popup|popunder|popads|popcash|propeller|adsterra|exoclick|juicyads|hilltopads|evadav|admaven|adcash|ad-|ads-|_ad|_ads|ad_|ads_)([-_#\s]|$)/i;
  const BAIT_ATTRS = ['data-ad', 'data-advert', 'data-sponsor', 'data-ad-client', 'data-ad-slot', 'data-zone', 'data-adunit'];
  const nativeMatches = Element.prototype.matches;
  const catalogBaits = sites.flatMap(site => site.bait);
  // Keep real geometry for elements hidden by our cosmetic layer.
  function isConcealed(element) {
    return element.getAttributeNames().some(name => name.startsWith('data-sg-'));
  }
  function baitFor(element) {
    if (!(element instanceof Element) || isConcealed(element)) return undefined;
    for (const bait of catalogBaits) { try { if (nativeMatches.call(element, bait.selector)) return bait; } catch { /* Skip invalid catalog selectors. */ } }
    const id = element.id;
    const cls = typeof element.className === 'string' ? element.className : element.getAttribute('class') || '';
    if ((id && BAIT.test(id)) || (cls && BAIT.test(cls))) return { width: 12, height: 12 };
    for (const attr of BAIT_ATTRS) if (element.hasAttribute(attr)) return { width: 12, height: 12 };
    return undefined;
  }
  const probe = element => baitFor(element) || { width: 12, height: 12 };
  for (const property of ['offsetHeight', 'offsetWidth']) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
    if (!original?.configurable || !original.get) continue;
    Object.defineProperty(HTMLElement.prototype, property, {
      ...original,
      get() {
        const value = original.get.call(this);
        if (value !== 0) return value;
        return baitFor(this) ? (property === 'offsetHeight' ? probe(this).height : probe(this).width) : value;
      }
    });
  }
  const nativeComputedStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = new Proxy(nativeComputedStyle, {
    apply(target, thisArg, args) {
      const style = Reflect.apply(target, thisArg, args);
      const [element, pseudo] = args;
      const bait = pseudo ? undefined : baitFor(element);
      if (!bait) return style;
      if (!['none', 'contents'].includes(style.display)) return style;
      const overrides = { display: 'block', visibility: 'visible', opacity: '1', width: `${bait.width}px`, height: `${bait.height}px` };
      return new Proxy(style, {
        get(target, key) {
          if (key === 'getPropertyValue') return property => Object.hasOwn(overrides, property) ? overrides[property] : Reflect.apply(target.getPropertyValue, target, [property]);
          if (Object.hasOwn(overrides, key)) return overrides[key];
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    }
  });

  const adDomains = data.networks.flatMap(network => network.domains);
  const popups = globalThis.StreamGuardPopups || { block: { host: [], any: [] }, allow: { host: [], any: [] } };
  const popupAllowHosts = new Set(popups.allow.host);
  const anyMatches = (url, patterns) => patterns.some(pattern => {
    const parts = pattern.split('*');
    let index = 0;
    for (const part of parts) {
      if (!part) continue;
      const found = url.indexOf(part, index);
      if (found < 0) return false;
      index = found + part.length;
    }
    return true;
  });
  const parseURL = input => { try { const url = new URL(String(input), location.href); return ['http:', 'https:'].includes(url.protocol) ? url : null; } catch { return null; } };
  const isAdURL = url => {
    if (!url) return false;
    const host = url.hostname;
    const allowed = popupAllowHosts.has(host) || popups.allow.any.some(pattern => anyMatches(url.href, [pattern]));
    if (allowed) return false;
    if (adDomains.some(domain => core.matchesHost(host, domain))) return true;
    if (popups.block.host.includes(host)) return true;
    return anyMatches(url.href, popups.block.any);
  };
  function captureLink(event) {
    if (!event.isTrusted || (event.type === 'click' && event.button !== 0) || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement && node.hasAttribute('href'));
    const url = link && parseURL(link.href);
    if (url && isAdURL(url)) event.preventDefault();
  }
  globalThis.addEventListener('click', captureLink, true);
  globalThis.addEventListener('auxclick', captureLink, true);
  const nativeOpen = globalThis.open;
  globalThis.open = new Proxy(nativeOpen, {
    apply(target, thisArg, args) {
      const [input, targetName, features] = args;
      const url = parseURL(input);
      if (url && isAdURL(url)) return null;
      return Reflect.apply(target, thisArg, [url ? url.href : input, targetName, features]);
    }
  });
  // Location methods cannot be overridden; use cancelable navigation events.
  if (globalThis === globalThis.top && globalThis.navigation?.addEventListener) {
    globalThis.navigation.addEventListener('navigate', event => {
      if (!event.cancelable || event.hashChange || event.navigationType === 'traverse' || event.navigationType === 'reload') return;
      const url = parseURL(event.destination.url);
      if (url && isAdURL(url)) event.preventDefault();
    });
  }
})();
