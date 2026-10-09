# Microsoft Edge compatibility

Assessed October 9, 2026 for adLibere 2.0.0. The same production package passed isolated headless browser smoke tests in **Chrome 155.0.8059.39** and **Microsoft Edge 154.0.4258.62**. No Edge Add-ons submission was performed.

## Verified package and runtime behavior

- Manifest V3 with a classic background service worker. All JavaScript, styles, icons and replacement resources are local to the package.
- `runtime`, `action`, `storage.local`, `scripting`, `alarms` and `declarativeNetRequest` APIs; no native messaging, browser-specific identity API or external application dependency.
- Both MAIN and ISOLATED content-script registrations, service-worker startup, dashboard state/export, popup blocking, ad API stubs, cosmetic hiding and synthetic playback overlay concealment passed in both tested browsers. A protected dialog and normal content remained visible.
- All six static rulesets loaded; actual network blocking and disabling/re-enabling protection passed. The build uses fewer than 250,000 static rules, at most 25,000 per file, within the project budget and Chromium ruleset-count limits. Dynamic rules use a conservative 5,000-rule budget, including local redirects.
- Extension-page CSP is `script-src 'self'; object-src 'none'`. No remote executable code, `eval`, inline executable scripts or telemetry is included. HTTPS filter downloads are parsed as data and stored locally.
- The manifest has no `update_url`. Existing permissions support the stated ad-filtering purpose: DNR for network rules; scripting and all-site host access for page protection; storage/unlimitedStorage for filter data; alarms for refresh scheduling. No permissions were added for this release.

The package declares Chrome 121 as its minimum. Edge 121 and Chrome 121 were not available for runtime tests; compatibility at those minimum versions is inferred from the APIs used, not verified by running those versions.

## Before an Edge Add-ons submission

Microsoft describes Chrome extension APIs and manifest keys as generally code-compatible with Edge, but still requires sideload testing and API review: [port a Chrome extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension).

Store acceptance is separate from technical compatibility. Review the current [Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies), prepare accurate store metadata and screenshots, explain each permission and the single ad-protection purpose, and provide a privacy disclosure covering local storage and direct connections to filter providers. These submission materials have not been prepared or reviewed here.

Further testing should cover real streaming playback, sign-in/player controls, live list refresh success and provider failures, browser restarts/upgrades, accessibility, long-running performance and coexistence with other blockers. Current smoke tests use synthetic pages and offline list-download conditions.

Chromium guarantees only 30,000 static rules per extension; enabling the rest depends on the browser's shared static-rule budget. The 127,951-rule release loaded completely in clean tested profiles. Other installed blockers can reduce availability. See [Chromium DNR limits](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#rule-limits). Existing ruleset-toggle failures are logged; there is no adaptive partial-ruleset fallback or dashboard warning for a shared-quota shortfall.

Popup and overlay heuristics can still interfere with legitimate sites. Unsupported upstream syntax is omitted, and network filtering cannot cover all server-side ad insertion. Third-party attribution and GPL notices accompany the ZIP; benchmark-derived local endpoints have separate attribution and redistribution considerations documented in [THIRD_PARTY.md](../THIRD_PARTY.md). Review those terms before commercial distribution or a store submission.
