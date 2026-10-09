# adLibere 2.0.0

A ready-to-install Manifest V3 production package with bundled EasyList, EasyPrivacy, AdGuard Base and local filters, plus popup protection, cosmetic hiding, playback-overlay countermeasures and a local dashboard.

## Changes

- Preserve first-party/third-party restrictions in generated network rules and retain those distinctions when deduplicating rules.
- Skip unsupported request modifiers and parameter-removal rules instead of converting them into broader blocks, including a playback-resource rule.
- Fail the build if the project's static-rule budget is exceeded instead of silently truncating filters.
- Add `npm run release:package`: offline build/tests, resource and rule validation, deterministic ZIP creation, integrity checks, independent extraction/byte comparison and SHA-256 generation. No npm dependencies were added.
- Remove clock-based build metadata, normalize text line endings, and retain filter attribution headers and MIT/GPL notices in the ZIP.
- Document release downloads, manual updates, checksums, future releases and Edge compatibility.

## Verification and compatibility

- Node.js 24.19.0: build and all **57 automated tests passed**; two package runs produced identical bytes.
- **Chrome 155.0.8059.39** and **Microsoft Edge 154.0.4258.62**: isolated headless smoke tests passed for the service worker, all six static rulesets, actual request blocking, MAIN/ISOLATED scripts, dashboard/export, popup blocking, ad stubs, cosmetics, synthetic playback overlays, protected page content and pause/resume.
- **127,951 static rules**, six rulesets, 2,833 popup hosts and 88 URL patterns. The ZIP was independently extracted and all files matched the build.
- Manifest minimum: Chrome 121. Minimum-version browsers were not run. Live streaming playback, successful online filter refreshes and multi-blocker shared-quota behavior were not tested. No browser-store submission was made.

## Install

1. Download **adLibere-v2.0.0.zip** and **adLibere-v2.0.0.zip.sha256** from the assets below. The Source code archives contain development inputs, not the installable extension.
2. Verify SHA-256. On PowerShell, compare `Get-FileHash .\adLibere-v2.0.0.zip -Algorithm SHA256` with `Get-Content .\adLibere-v2.0.0.zip.sha256`. On Linux use `sha256sum -c adLibere-v2.0.0.zip.sha256`; on macOS use `shasum -a 256 -c adLibere-v2.0.0.zip.sha256`.
3. Extract the ZIP into a permanent folder with `manifest.json` at its root. Node.js is not required.
4. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
5. Reload open web pages. Click adLibere's icon to open the dashboard.

For manual updates, close the browser and replace all files in the same loaded folder with the verified new release contents. Reopen the browser, reload the extension and affected web pages. GitHub installations do not automatically update extension code; automatic filter refreshes only update data.

## Limitations and notices

The parser supports a subset of upstream syntax. Heuristics may affect legitimate site controls, and not all server-side ads can be filtered. Chromium's shared static-rule budget can limit available protection when other blockers are installed. See the [compatibility report](https://github.com/emillvl/adLibere/blob/v2.0.0/docs/EDGE_COMPATIBILITY.md).

No telemetry or new permissions were added. Settings and downloaded filters remain in local browser storage; list updates contact providers directly. Filter-data GPL notices and source references accompany the ZIP. The matching Source code archives provide the input snapshots and conversion tools. See [third-party notices](https://github.com/emillvl/adLibere/blob/v2.0.0/THIRD_PARTY.md), including the separate benchmark-derived endpoint redistribution considerations.
