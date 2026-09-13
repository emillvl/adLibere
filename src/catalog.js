globalThis.StreamGuardCatalog = {
  "name": "adLibere",
  "version": "1.0.0",
  "networks": [
    {
      "id": "adsterra",
      "kind": "network",
      "firstSeen": null,
      "reviewed": "2026-09-12",
      "domains": [
        "adsterra.com"
      ],
      "techniques": [
        "ad-script-load"
      ],
      "evidence": {
        "status": "upstream-seed",
        "summary": "The network domain appears in EasyList. This seed does not attribute any particular detection implementation or rotating serving hostname to Adsterra.",
        "sources": [
          "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt"
        ]
      },
      "rules": [
        "||adsterra.com^$script,redirect=noop.js",
        "||adsterra.com^$image,redirect=1x1.gif",
        "||adsterra.com^$subdocument,redirect=noop.html"
      ],
      "globals": [],
      "countermeasures": [
        "local-resource-redirect",
        "trusted-link-popup-guard"
      ],
      "limitations": "The brand domain is not a complete set of serving domains. Add observed invoke.js/Smartlink aliases separately; do not assume ownership from a suggestive domain name."
    },
    {
      "id": "exoclick",
      "kind": "network",
      "firstSeen": null,
      "reviewed": "2026-09-12",
      "domains": [
        "exoclick.com",
        "exosrv.com"
      ],
      "techniques": [
        "ad-script-load",
        "missing-global"
      ],
      "evidence": {
        "status": "upstream-seed",
        "summary": "EasyList supplies serving-domain seeds; ExoClick documents the AdProvider.push queue interface. No specific live-site bypass is claimed.",
        "sources": [
          "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt",
          "https://www.exoclick.com/get-faster-banner-ad-load-times-with-asynchronous-tags/"
        ]
      },
      "rules": [
        "||exoclick.com^$script,redirect=noop.js",
        "||exosrv.com^$script,redirect=noop.js",
        "||exosrv.com^$image,redirect=1x1.gif"
      ],
      "globals": [
        {
          "name": "AdProvider",
          "profile": "queue"
        }
      ],
      "countermeasures": [
        "local-resource-redirect",
        "global-stub",
        "playback-overlay-heuristic"
      ],
      "limitations": "The queue is inert and does not emulate the full ad API or ad-completion events."
    },
    {
      "id": "juicyads",
      "kind": "network",
      "firstSeen": null,
      "reviewed": "2026-09-12",
      "domains": [
        "juicyads.com"
      ],
      "techniques": [
        "ad-script-load"
      ],
      "evidence": {
        "status": "upstream-seed",
        "summary": "EasyList lists third-party script loads for this network. Global SDK shapes are not asserted without first-party evidence.",
        "sources": [
          "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt"
        ]
      },
      "rules": [
        "||juicyads.com^$script,redirect=noop.js",
        "||juicyads.com^$image,redirect=1x1.gif"
      ],
      "globals": [],
      "countermeasures": [
        "local-resource-redirect",
        "trusted-link-popup-guard"
      ],
      "limitations": "Site-specific SDK checks and serving aliases require a documented follow-up entry."
    },
    {
      "id": "popads",
      "kind": "network",
      "firstSeen": null,
      "reviewed": "2026-09-12",
      "domains": [
        "popads.net"
      ],
      "techniques": [
        "click-popunder",
        "missing-global"
      ],
      "evidence": {
        "status": "upstream-seed",
        "summary": "uBlock Origin documents PopAds/popns dummy objects; EasyList lists the network domain.",
        "sources": [
          "https://github.com/gorhill/uBlock/wiki/Resources-Library#popads-dummyjs-",
          "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt"
        ]
      },
      "rules": [
        "||popads.net^$script,redirect=noop.js",
        "||popads.net^$image,redirect=1x1.gif"
      ],
      "globals": [
        {
          "name": "PopAds",
          "profile": "object"
        },
        {
          "name": "popns",
          "profile": "object"
        }
      ],
      "countermeasures": [
        "local-resource-redirect",
        "global-stub",
        "trusted-link-popup-guard"
      ],
      "limitations": "Empty objects pass existence checks only; undocumented methods are not fabricated."
    },
    {
      "id": "propellerads",
      "kind": "network",
      "firstSeen": null,
      "reviewed": "2026-09-12",
      "domains": [
        "propellerads.com",
        "propellerclick.com"
      ],
      "techniques": [
        "click-popunder",
        "anti-adblock-delivery"
      ],
      "evidence": {
        "status": "upstream-seed",
        "summary": "Vendor documents OnClick popunders and anti-adblock delivery. Domains are a small EasyList seed, not a complete rotating-domain inventory or a verified streaming-site observation.",
        "sources": [
          "https://help.propellerads.com/en/articles/9367575-how-to-create-an-onclick-campaign",
          "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt"
        ]
      },
      "rules": [
        "||propellerads.com^$script,redirect=noop.js",
        "||propellerads.com^$image,redirect=1x1.gif",
        "||propellerclick.com^$script,redirect=noop.js"
      ],
      "globals": [],
      "countermeasures": [
        "local-resource-redirect",
        "trusted-link-popup-guard",
        "playback-overlay-heuristic"
      ],
      "limitations": "Publisher-side proxy scripts and rotating aliases need separate evidence and narrowly scoped rules. No undocumented Propeller SDK globals are invented."
    },
    {
      "id": "popunder-guard",
      "kind": "network",
      "firstSeen": "2026-09-13",
      "reviewed": "2026-09-13",
      "domains": [
        "popads.net",
        "popadscdn.net",
        "popcash.net",
        "propellerads.com",
        "propellerclick.com",
        "propeller-tracking.com",
        "adcash.com",
        "ctrtraffic.com",
        "hilltopads.net",
        "evadav.com",
        "admaven.com",
        "adk2x.com"
      ],
      "techniques": [
        "click-popunder",
        "missing-global"
      ],
      "evidence": {
        "status": "vendor-documented",
        "summary": "Vendor-documented popunder/popup serving domains used by streaming sites. Guarded globally: network loads are redirected and window.open/navigation to these domains is denied from every page.",
        "sources": [
          "https://www.popads.net/",
          "https://popcash.net/",
          "https://help.propellerads.com/",
          "https://www.adcash.com/",
          "https://hilltopads.net/",
          "https://evadav.com/"
        ]
      },
      "rules": [
        "||popads.net^$script,redirect=noop.js",
        "||popadscdn.net^$script,redirect=noop.js",
        "||popcash.net^$script,redirect=noop.js",
        "||propellerclick.com^$script,redirect=noop.js",
        "||propeller-tracking.com^$script,redirect=noop.js",
        "||adcash.com^$script,redirect=noop.js",
        "||ctrtraffic.com^$script,redirect=noop.js",
        "||hilltopads.net^$script,redirect=noop.js",
        "||evadav.com^$script,redirect=noop.js",
        "||admaven.com^$script,redirect=noop.js",
        "||adk2x.com^$script,redirect=noop.js"
      ],
      "globals": [
        {
          "name": "PopAds",
          "profile": "object"
        },
        {
          "name": "popns",
          "profile": "object"
        }
      ],
      "countermeasures": [
        "local-resource-redirect",
        "global-stub",
        "trusted-link-popup-guard",
        "navigation-api-guard"
      ],
      "limitations": "A curated seed of the largest popunder networks, not an exhaustive rotating-domain inventory. Unlisted aliases are still caught by the network list and the overlay detector."
    },
    {
      "id": "related-adservers",
      "kind": "network",
      "firstSeen": null,
      "reviewed": "2026-09-12",
      "domains": [
        "highperformanceformat.com",
        "popcash.net"
      ],
      "techniques": [
        "ad-script-load"
      ],
      "evidence": {
        "status": "upstream-seed",
        "summary": "Additional domains listed by EasyList. Ownership is intentionally unassigned; the entries only establish ad-serving classification.",
        "sources": [
          "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt"
        ]
      },
      "rules": [
        "||highperformanceformat.com^$script,redirect=noop.js",
        "||popcash.net^$script,redirect=noop.js"
      ],
      "globals": [],
      "countermeasures": [
        "local-resource-redirect",
        "trusted-link-popup-guard"
      ],
      "limitations": "A seed, not a general ad blocklist; independently validate any additional aliases."
    }
  ],
  "sites": [],
  "upstreams": [
    {
      "name": "EasyList",
      "url": "https://easylist.to/easylist/easylist.txt",
      "purpose": "General ad coverage; keep enabled in your main blocker."
    },
    {
      "name": "AdGuard Annoyances",
      "url": "https://filters.adtidy.org/extension/ublock/filters/14.txt",
      "purpose": "Existing annoyance rules; review upstream licensing before copying."
    },
    {
      "name": "Adblock Warning Removal List",
      "url": "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt",
      "purpose": "Existing warning-removal coverage; check upstream freshness before relying on it."
    }
  ]
};
