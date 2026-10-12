# Landasan Digital SOC Portal: setup (v4)

All commands run in Windows PowerShell on your computer.

## 1. Upload the site
```powershell
cd C:\Users\izzat\Documents\cyberguard-site
pac pages upload --path "cyberguard-portal" --modelVersion 2
```
Do not add `--forceUploadAll`: the downloaded `sitesetting.yml` still has `Search/Enabled = False` and would switch search off.

## 2. Create the new tables and fix the role links
```powershell
& "C:\Users\izzat\Downloads\PowerPages\SOC-Dashboard-main\SOC-Dashboard-main\CyberGuard Portal\setup\setup-portal-v4.ps1" -EnvUrl https://org5a61f085.crm5.dynamics.com -WebsiteId 36e7a73f-f9fd-4219-ad99-31ae7dfb6aab
```
It signs you in with a device code, then prints PASS or FAIL for each step. Safe to run again.

## 3. Check and refresh
- Power Pages > Security > Table permissions: every row must show a role in the Roles column. If a row shows "--", the script prints which roles to add by hand.
- Click Sync, then hard refresh the portal (Ctrl+F5).

## Pages
| Page | Address | Data |
|---|---|---|
| Home | / | incidents, last handover |
| Dashboard | /dashboard/ | cg_incident |
| Handover | /handover/ | cg_handover |
| Watchlist | /watchlist/ | cg_indicator |
| Playbooks | /playbooks/ | none (ticks saved in the browser) |
| Reports | /reports/ | cg_incident |
| Help | /faq/ | cg_article (optional extra answers) |
| Incident response | /incident-response/ | creates cg_incident |
| Escalation | /escalation/ | none |
| Contact | /contact-us/ | creates cg_contactmessage |
| About, Profile | /about-us/, /profile/ | none |

## Editing
- Text on each page: Power Pages > Pages > the page > Edit code, or the files in `web-pages/`.
- Design: `web-files/theme.css` (source with comments in `design/theme.src.css`).
- Menu: the links are in the Header web template.
