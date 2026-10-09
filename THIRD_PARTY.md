# Third-party sources

## Filter snapshots

These files are bundled inputs to the build. Their original headers, version information, and attribution are preserved.

| File | Source | License reference from the source header |
| --- | --- | --- |
| `lists/easylist.txt` | [EasyList](https://easylist.to/easylist/easylist.txt) | [EasyList licensing](https://easylist.to/pages/licence.html) |
| `lists/easyprivacy.txt` | [EasyPrivacy](https://easylist.to/easylist/easyprivacy.txt) | [EasyList licensing](https://easylist.to/pages/licence.html) |
| `lists/adguard-base.txt` | [AdGuard Base + EasyList](https://filters.adtidy.org/extension/ublock/filters/2.txt) | [AdGuard Filters license](https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE) |

Generated rulesets in `dist/rulesets/` and popup patterns in `dist/popup-patterns.js` are derived from these lists and the local additions in `lists/adlibere-extra.txt`.

### Production distribution notices

Copyright in EasyList and EasyPrivacy belongs to **The EasyList authors** (https://easylist.to/). EasyList offers GPL version 3 or later, or Creative Commons Attribution-ShareAlike 3.0 or later. This distribution uses the GPL option for the derived filter data. AdGuard filter data is distributed under GPL version 3; its authors and original notices are retained in `lists/adguard-base.txt`.

adLibere 2.0.0 converts the September 13, 2026 snapshots to Manifest V3 JSON rules and popup pattern arrays, deduplicates supported rules, and adds local filters. These derived data files were prepared for release on October 9, 2026. They remain under their upstream GPL terms; adLibere's own MIT license does not replace those terms. A copy of GPL version 3 is included at `licenses/GPL-3.0.txt` in both the source repository and production ZIP.

The ZIP includes this notice and `filter-sources.json`, which records the original attribution headers and links to the exact input snapshots at the release tag. The complete corresponding inputs and conversion tools are available without charge from the matching **Source code** archives on the [GitHub Releases page](https://github.com/emillvl/adLibere/releases). `npm run build` regenerates the derived data from those inputs without downloading lists.

## Benchmark data

[`tests/fixtures/benchmark-hosts.json`](tests/fixtures/benchmark-hosts.json) records requests from:

- [Turtlecute's host list](https://adblock.turtlecute.org/d3host.txt). The saved fixture identifies its license as CC BY-NC-SA.
- [Super Adblock Test's probe definitions](https://superadblocktest.com/adblock.js). The saved fixture does not specify a license.

`tools/extract-benchmarks.mjs` rebuilds the fixture from local copies of those files. The fixture is used for offline regression tests. Local filter additions also include endpoints and scoped paths drawn from these benchmark definitions.

The benchmark fixture and tools are excluded from the installable ZIP. The scope of the benchmark sources' terms for the local endpoint additions remains a consideration for future store submission or commercial redistribution; this notice does not relicense third-party material.

## Catalog references

`src/catalog.js` includes source URLs for its network entries. The exported subscription also references companion lists; those references do not cause the build to bundle them.
