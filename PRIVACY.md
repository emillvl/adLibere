# adLibere privacy policy

Last updated October 9, 2026. Covers adLibere 2.0.0 for Microsoft Edge.

adLibere filters network requests and runs page scripts to reduce advertisements, unwanted popups, playback overlays and some anti-adblock checks. It does this inside your browser.

## Information used in your browser

The browser applies network filtering rules to request URLs, resource types and the sites that initiate requests. adLibere's page scripts inspect the current page's hostname, links, elements, styles, media layout and playback events to decide what to block or conceal. They also inspect link clicks and pointer events around video players to distinguish unwanted popups and overlays from normal controls. They can access page content because protection runs across supported websites and frames. Browser-protected pages are outside that access.

These features access website content, current-page and destination URLs, and limited user activity within the page. Page scripts keep temporary playback and interaction state in memory. They do not log typed text or maintain a record of your clicks or mouse movements.

The extension does not create a browsing-history database, upload page contents or send filtering decisions to the developer. It does not read passwords, authentication cookies or payment information as part of its filtering logic.

## Local storage and controls

Microsoft Edge's local extension storage holds the global protection setting, downloaded filter rules and update metadata, including an update time and rule count. adLibere has no user account, developer-operated backend or analytics service.

You can pause protection from the dashboard. Reload open pages to apply the change to page scripts already injected. Pausing protection does not disable scheduled filter-list refresh checks. The dashboard also lets you refresh lists and export catalog filters. The exported file contains catalog rules, not your browsing history.

Uninstalling the extension removes its extension storage through Microsoft Edge. Files you exported remain on your device until you delete them.

## Filter-provider connections

The extension directly downloads filter data over HTTPS from:

- EasyList and EasyPrivacy at `easylist.to`.
- AdGuard Base at `filters.adtidy.org`.

The browser connects to these providers at startup and on scheduled refresh checks, or when you request an update. Scheduled checks skip downloads while stored data is less than 24 hours old. Downloaded lists are parsed as filter data; the extension does not download executable code.

Providers receive the connection information normally needed to serve an HTTPS request, such as your IP address and browser request headers. The extension does not add browsing history, page contents or a user identifier to these downloads. The providers operate independently and their own policies apply to their services.

## Sharing and support

The extension uses this information only for its filtering and protection features. It does not sell data, transmit it to the developer, use it for unrelated advertising, collect analytics, or use it to determine creditworthiness or make lending decisions. Its direct provider connections are described above.

If you contact support or open a public GitHub issue, you choose what information to send. Public issues are visible to other people. Do not include credentials, private browsing data or other sensitive information.

Source and support: https://github.com/emillvl/adLibere

Issues: https://github.com/emillvl/adLibere/issues

This policy describes adLibere 2.0.0. It does not describe the independent data practices of Microsoft Edge, GitHub, websites you visit or filter providers.
