# CyberGuard Portal v2 — set-up guide

Everything runs from Windows PowerShell. Replace paths with yours.

## 1. Put the new design on the site
```powershell
# 1. Download this repo (Code > Download ZIP) and unzip, or `git pull`.
# 2. Copy the files into your downloaded site folder (the one with web-pages, web-templates ...)
cd "<repo>\CyberGuard Portal\setup"
.\apply-to-site.ps1 -Site "C:\Users\izzat\Documents\cyberguard-site\<site-folder>"
# 3. Upload
cd "C:\Users\izzat\Documents\cyberguard-site"
pac pages upload --path "<site-folder>" --modelVersion 2
```
Then open Power Pages > Site actions > **Sync configuration** (or wait a minute) and hard-refresh (Ctrl+Shift+R).
Without step 2 below the site still works: it shows clearly labelled **sample data**.

## 2. Turn on live data (Dataverse)
```powershell
cd "<repo>\CyberGuard Portal\setup"
# creates solution CyberGuardPortal, tables cg_incident / cg_contactmessage / cg_article, sample rows
.\setup-dataverse.ps1 -EnvUrl https://org5a61f085.crm5.dynamics.com
# creates Web API site settings, the "SOC Analyst" web role and table permissions; gives you the role
.\configure-portal.ps1 -EnvUrl https://org5a61f085.crm5.dynamics.com -WebsiteId 36e7a73f-f9fd-4219-ad99-31ae7dfb6aab -AssignTo your.email@company.com
```
Both ask you to sign in with a device code (open the link, type the code). Both are safe to re-run.
`-AssignTo` needs the person to have signed in to the portal once (so their contact exists).

If `configure-portal.ps1` cannot do a step it says so; do it by hand in the **Portal Management** app:
* Site Settings: `Webapi/<table>/enabled = true` and `Webapi/<table>/fields = <columns>` for `cg_incident`, `cg_contactmessage`, `cg_article`; plus `Webapi/error/innererror = true`.
* Web Roles: create **SOC Analyst**, assign it to your contact.
* Table Permissions (scope Global): SOC Analyst → cg_incident read/write/create; Authenticated Users → cg_incident create; Anonymous + Authenticated → cg_article read, cg_contactmessage create.

## 3. Check it works
* Dashboard badge says **Live data · Dataverse** (green). "Sample data" = Dataverse not connected; the yellow notice under the title says why (not signed in, no role, missing site setting).
* Report an incident on *Incident response* → it appears on the Dashboard with an `INC-yyyy-nnnn` reference.
* Contact form → a row appears in the `cg_contactmessage` table.
* FAQ: add a row to `cg_article` and it shows up under the static questions.

## Other Power Pages features worth turning on
* **Search** (Set up > Site settings > Enable site search) — the header search and Ctrl K palette link to it.
* **Page access**: set Dashboard to *Restricted* to the SOC Analyst role (Pages workspace > page > Permissions).
* **Power Automate**: trigger a flow on new `cg_incident` rows (Teams/e-mail alert for critical).
* **Copilot** (Set up > Copilot) for an in-site assistant, and **Analytics** to see traffic.
