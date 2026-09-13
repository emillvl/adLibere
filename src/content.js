(() => {
  'use strict';
  if (globalThis.__streamGuardContent) return;
  globalThis.__streamGuardContent = true;
  const core = globalThis.StreamGuardCore;
  const data = globalThis.StreamGuardCatalog;
  const sites = data.sites.filter(site => site.domains.some(domain => core.matchesHost(location.hostname, domain)));
  const cosmeticSelectors = sites.flatMap(site => site.cosmetics);
  const allowSelectors = sites.flatMap(site => site.allowSelectors);
  const preserved = 'video,audio,track,source,html,body,script,style,link,meta,dialog,[role="dialog"],[role="menu"],[role="menubar"],[role="slider"],[role="status"],[aria-live],[contenteditable="true"]';
  const token = `sg-${Math.random().toString(36).slice(2, 10)}`;
  const ATTR = `data-${token}`;
  const HIDE_ATTR = `data-${token}-hide`;
  const RULE = `[${ATTR}], [${ATTR}] * { opacity: 0 !important; pointer-events: none !important; user-select: none !important; } [${HIDE_ATTR}], [${HIDE_ATTR}] * { display: none !important; }`;
  const style = document.createElement('style');
  style.textContent = RULE;
  (document.head || document.documentElement).append(style);
  const videos = new Map();
  const candidates = new Set();
  const roots = new Set();
  const concealed = new WeakSet();
  const cosmeticSet = new WeakSet();
  const lastRects = new WeakMap();
  let scheduled = 0;
  let stopped = false;
  let sweepPending = false;
  const WINDOW = 2200;
  const MAX_BATCH = 400;
  const safeMatch = (element, selector) => { try { return element.matches(selector); } catch { return false; } };

  function restoreStyle() {
    if (!style.isConnected) (document.head || document.documentElement).append(style);
    if (style.textContent !== RULE) style.textContent = RULE;
  }
  function blockEvent(event) {
    const path = event.composedPath();
    for (const node of path) {
      if (node instanceof Element && (node.hasAttribute(ATTR) || node.hasAttribute(HIDE_ATTR))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
  }
  for (const type of ['focus', 'focusin', 'keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'auxclick', 'contextmenu', 'touchstart', 'touchend']) {
    document.addEventListener(type, blockEvent, true);
  }
  // Document styles cannot reach inside shadow roots.
  function shadowConceal(element, hide = false) {
    if (!(element.getRootNode() instanceof ShadowRoot)) return;
    const pairs = hide ? [['display', 'none']] : [['opacity', '0'], ['pointer-events', 'none']];
    for (const [property, value] of pairs) {
      if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== 'important') element.style.setProperty(property, value, 'important');
    }
  }
  function conceal(element) {
    if (concealed.has(element)) return;
    concealed.add(element);
    element.setAttribute(ATTR, '');
    shadowConceal(element, false);
  }
  // Collapse known ad containers; overlay concealment preserves layout.
  const COSMETIC_TOKENS = new Set(['adsbox', 'adbox', 'banner_ads', 'banner-ads', 'banner-ad', 'banner_ad', 'bannerads', 'adbanner', 'ad-banner', 'ad-banner-1', 'adbox-wrapper', 'adbox_wrapper', 'adboxwrapper', 'textads', 'text-ad', 'text_ads', 'adslot', 'ad-slot', 'ad-iframe', 'ad-box', 'ad-placeholder', 'ad-placement', 'ad-wrapper', 'adsbygoogle', 'adsocial', 'ad-div', 'ad-holder', 'ad-content', 'advertisement', 'ad-unit', 'ad-container', 'ads-block', 'ad-block', 'sponsored-box', 'sponsored-content', 'sponsor-box']);
  function cosmeticHit(element) {
    const id = element.id;
    if (id && COSMETIC_TOKENS.has(id.toLowerCase())) return true;
    const cls = typeof element.className === 'string' ? element.className : '';
    if (!cls) return false;
    return cls.split(/\s+/).some(token => COSMETIC_TOKENS.has(token.toLowerCase()));
  }
  function descendantCount(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let count = 0;
    while (walker.nextNode() && ++count <= 40) {}
    return count;
  }
  function cosmeticConceal(element) {
    if (cosmeticSet.has(element) || concealed.has(element) || !cosmeticHit(element)) return;
    if (descendantCount(element) > 40) return; // Leave large containers intact.
    cosmeticSet.add(element);
    element.setAttribute(HIDE_ATTR, '');
    shadowConceal(element, true);
  }
  function rememberVideo(video) {
    if (!videos.has(video)) videos.set(video, { started: -Infinity, advanced: -Infinity, clicked: -Infinity, time: video.currentTime });
  }
  function queue(element) {
    if (!(element instanceof Element)) return;
    if (candidates.size < MAX_BATCH) candidates.add(element);
    if (!scheduled && !stopped) scheduled = requestAnimationFrame(flush);
  }
  function discover(node) {
    if (!(node instanceof Element) && !(node instanceof Document) && !(node instanceof ShadowRoot)) return;
    if (node instanceof Element) {
      queue(node);
      if (node instanceof HTMLVideoElement) rememberVideo(node);
      if (node.shadowRoot) observeRoot(node.shadowRoot);
    }
    // Bound each scan to avoid traversing an entire busy page at once.
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    let element;
    let count = 0;
    while (count++ < MAX_BATCH && (element = walker.nextNode())) {
      if (element instanceof HTMLVideoElement) rememberVideo(element);
      if (element.shadowRoot) observeRoot(element.shadowRoot);
      queue(element);
    }
  }
  function mediaEvent(event) {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) return;
    rememberVideo(video);
    const state = videos.get(video);
    const now = performance.now();
    if (event.type === 'play' || event.type === 'playing') {
      state.started = now;
      sweepPending = true;
      discover(video.getRootNode());
    } else if (event.type === 'timeupdate' && !video.paused && video.currentTime > state.time) {
      state.advanced = now;
    }
    state.time = video.currentTime;
  }
  function clickEvent(event) {
    if (!event.isTrusted) return;
    for (const [video, state] of videos) {
      const rect = video.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        state.clicked = performance.now();
        discover(video.getRootNode());
      }
    }
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) discover(node);
      else queue(record.target);
    }
    if (!style.isConnected || style.textContent !== RULE) restoreStyle();
  });
  function observeRoot(root) {
    if (roots.has(root)) return;
    roots.add(root);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open', ATTR, HIDE_ATTR] });
    for (const type of ['play', 'playing', 'timeupdate']) root.addEventListener(type, mediaEvent, true);
    root.addEventListener('pointerdown', clickEvent, true);
    discover(root);
  }
  function relatedToVideo(element) {
    for (const video of videos.keys()) if (element === video || element.contains(video) || video.contains(element)) return true;
    return !!element.querySelector('video,audio');
  }
  function protectedElement(element) {
    return safeMatch(element, preserved) || !!element.closest('dialog,[role="dialog"],[aria-live]') || allowSelectors.some(selector => { try { return !!element.closest(selector); } catch { return false; } });
  }
  function inspect(element, now) {
    if (!element.isConnected) return;
    if (concealed.has(element)) {
      if (!element.hasAttribute(ATTR)) element.setAttribute(ATTR, '');
      shadowConceal(element, false);
      return;
    }
    if (cosmeticSet.has(element)) {
      if (!element.hasAttribute(HIDE_ATTR)) element.setAttribute(HIDE_ATTR, '');
      shadowConceal(element, true);
      return;
    }
    if (protectedElement(element) || relatedToVideo(element)) return;
    if (cosmeticHit(element)) { cosmeticConceal(element); return; }
    if (cosmeticSelectors.some(selector => safeMatch(element, selector))) { conceal(element); return; }
    const styleInfo = getComputedStyle(element);
    if (!['fixed', 'absolute'].includes(styleInfo.position)) return;
    const rect = element.getBoundingClientRect();
    for (const [video, state] of videos) {
      if (!video.isConnected) { videos.delete(video); continue; }
      const recent = now - Math.max(state.started, state.clicked) <= WINDOW || (!video.paused && now - state.advanced <= WINDOW);
      let videoRect = video.getBoundingClientRect();
      if (videoRect.width && videoRect.height) lastRects.set(video, videoRect);
      else videoRect = lastRects.get(video) || videoRect;
      if (core.overlayDecision({ rect, videoRect, viewport: { width: innerWidth, height: innerHeight }, style: styleInfo, recent, related: false, protectedElement: false })) { conceal(element); break; }
    }
  }
  function flush() {
    scheduled = 0;
    const batch = [...candidates];
    candidates.clear();
    const now = performance.now();
    for (const element of batch) inspect(element, now);
    if (sweepPending) { sweepPending = false; }
  }
  observeRoot(document);
  globalThis.addEventListener('pagehide', () => { stopped = true; observer.disconnect(); if (scheduled) cancelAnimationFrame(scheduled); scheduled = 0; candidates.clear(); });
  globalThis.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    stopped = false;
    for (const root of roots) observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open', ATTR, HIDE_ATTR] });
    discover(document);
  });
})();
