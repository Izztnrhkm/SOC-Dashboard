# CyberGuard Portal (SOC Dashboard)

Power Pages site content, redesigned with a minimalist light theme.

- `CyberGuard Portal/web-files/theme.css` — the single shared stylesheet
- `CyberGuard Portal/web-templates/` — header, footer, search results, layouts
- `CyberGuard Portal/web-pages/` — one folder per page (HTML + JS)

Dashboard and forms currently run on sample data stored in the browser.
Connect Dataverse to make them live.

Note: this export has no `website.yml`, so re-export with `pac pages download`
and copy these files over it before running `pac pages upload`.
