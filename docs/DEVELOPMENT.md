# Develop adLibere

[← adLibere](../README.md)

## Build and load

Use **Node.js 24 or later** and **Chrome 121 or later**. The build runs
offline using the snapshots in `lists/`. There are no npm dependencies to
install.

```sh
npm run build
npm test
```

`npm test` rebuilds the extension before running the suite. In
`chrome://extensions`, enable **Developer mode**, choose **Load unpacked**,
and select **`dist/`**, not the repository root or `src/`. If you previously
loaded the root, remove that unpacked copy. After source changes, rebuild and
reload the extension, then reload the page under test.

The build recreates `dist/` from scratch. Edit `src/` and `lists/`. Generated
files and browser caches are excluded from Git.

## Repository map

| Path | Role |
| --- | --- |
| [`src/background.js`](../src/background.js) | List refreshes, rule activation, and script registration. |
| [`src/core.js`](../src/core.js) | Filter parsing and shared decision logic. |
| [`src/catalog.js`](../src/catalog.js) | Network rules and site configuration. |
| [`src/main.js`](../src/main.js) | Page-level popup and anti-adblock handling. |
| [`src/content.js`](../src/content.js) | DOM observation and cosmetic filtering. |
| [`src/manifest.json`](../src/manifest.json) | Source manifest. The build adds the static rulesets. |
| [`src/options.html`](../src/options.html) | Dashboard markup, alongside its styles and behavior. |
| [`lists/`](../lists/) | Upstream filter snapshots and local additions. |
| [`tests/`](../tests/) | Automated tests and saved benchmark inputs. |
| [`tools/`](../tools/) | Build, validation, packaging, browser smoke tests, and benchmark fixture tooling. |
| `dist/`, `release/` | Generated extension and verified release artifacts, ignored by Git. |

## Test the behavior

The offline suite covers filter conversion, catalog rules, overlay decisions,
generated bundles, manifest resources, dynamic-rule assembly, release
packaging, and saved benchmark requests. Third-party request restrictions
are retained when converting to browser rules. Unsupported request modifiers
and parameter-removal rules are skipped instead of converted into broader
blocks.

For browser smoke tests, use a recent Chromium build that supports the
DevTools `Extensions.loadUnpacked` command:

```sh
npm run test:browser
node tools/browser-smoke.mjs "/path/to/browser" "/path/to/extracted-folder"
```

The default executable is installed Chrome on Windows and `chromium`
elsewhere. Set `ADLIBERE_BROWSER` or supply a path to select another browser.
These tests use a temporary profile and package copy, local synthetic pages,
and an intercepted request. They exercise startup, blocking, scripts, popup
and overlay handling, protected content, pause/resume, and dashboard/export.
They do not cover live filter downloads or real streaming playback and
are separate from the offline packaging gate.

Benchmark checks use frozen input and an approximate request matcher.
They are regression tests, not live browser scores or end-to-end playback
tests. Local rules for benchmark probe paths are scoped to those benchmark
domains. The [fixture](../tests/fixtures/benchmark-hosts.json) records source
links. To regenerate it from downloaded inputs:

```sh
node tools/extract-benchmarks.mjs /path/to/d3host.txt /path/to/adblock.js
```

## Package a release

```sh
npm run release:package
node tools/validate.mjs /path/to/extracted-folder
```

The packaging command builds and tests `dist/`, validates assets and rule
budgets, checks ZIP headers and CRCs, independently extracts the ZIP and
compares every file with the build, and emits
`release/adLibere-vX.Y.Z.zip` and its `.zip.sha256`. It stops on a failed
check. Use the second command to validate an already extracted package.

Packaging needs Windows PowerShell/.NET on Windows or `unzip` on Linux/macOS.
The build contains no clock-derived metadata. Archive entries use stable
ordering, fixed timestamps and permissions, and normalized text line endings.
Identical source inputs and the same Node.js/zlib version produce identical ZIP
bytes. Source or compressor changes can change the checksum.

Follow the [release procedure](RELEASING.md) before publishing a tag or assets.

## Make a change

- Keep local filters in [`lists/adlibere-extra.txt`](../lists/adlibere-extra.txt).
  Preserve upstream snapshots and attribution headers.
- Keep network-specific rules and source references in
  [`src/catalog.js`](../src/catalog.js).
- Add a regression case for filtering or detection changes, then run
  `npm test`. Record browser tests as skipped if you cannot run them.
