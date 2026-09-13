# Third-party sources

## Filter snapshots

These files are bundled inputs to the build. Their original headers, version information, and attribution are preserved.

| File | Source | License reference from the source header |
| --- | --- | --- |
| `lists/easylist.txt` | [EasyList](https://easylist.to/easylist/easylist.txt) | [EasyList licensing](https://easylist.to/pages/licence.html) |
| `lists/easyprivacy.txt` | [EasyPrivacy](https://easylist.to/easylist/easyprivacy.txt) | [EasyList licensing](https://easylist.to/pages/licence.html) |
| `lists/adguard-base.txt` | [AdGuard Base + EasyList](https://filters.adtidy.org/extension/ublock/filters/2.txt) | [AdGuard Filters license](https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE) |

Generated rulesets in `dist/rulesets/` and popup patterns in `dist/popup-patterns.js` are derived from these lists and the local additions in `lists/adlibere-extra.txt`.

## Benchmark data

[`tests/fixtures/benchmark-hosts.json`](tests/fixtures/benchmark-hosts.json) records requests from:

- [Turtlecute's host list](https://adblock.turtlecute.org/d3host.txt). The saved fixture identifies its license as CC BY-NC-SA.
- [Super Adblock Test's probe definitions](https://superadblocktest.com/adblock.js). The saved fixture does not specify a license.

`tools/extract-benchmarks.mjs` rebuilds the fixture from local copies of those files. The fixture is used for offline regression tests. Local filter additions also include endpoints and scoped paths drawn from these benchmark definitions.

## Catalog references

`src/catalog.js` includes source URLs for its network entries. The exported subscription also references companion lists; those references do not cause the build to bundle them.
