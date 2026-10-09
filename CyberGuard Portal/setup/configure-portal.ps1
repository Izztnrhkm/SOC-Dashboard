<#
 CyberGuard Portal - Power Pages configuration
 Creates (idempotently) in your Dataverse environment:
   * Web API site settings for cg_incident, cg_contactmessage and cg_article
   * Web role "SOC Analyst"
   * Table permissions so the portal can read/write the three tables
 Run AFTER setup-dataverse.ps1:
   .\configure-portal.ps1 -EnvUrl https://org5a61f085.crm5.dynamics.com -WebsiteId 36e7a73f-f9fd-4219-ad99-31ae7dfb6aab -AssignTo you@company.com
 -AssignTo (optional) gives that person's portal contact the SOC Analyst role. The person must have signed in to the portal at least once.
#>
param(
  [Parameter(Mandatory = $true)][string]$EnvUrl,
  [Parameter(Mandatory = $true)][string]$WebsiteId,
  [string]$AssignTo
)
$ErrorActionPreference = 'Stop'
$EnvUrl = $EnvUrl.TrimEnd('/')
$Api = "$EnvUrl/api/data/v9.2"
$ClientId = '51f81489-12ee-4a9e-aaae-a2591f45987d'

# ---------- sign in (device code) ----------
$dc = Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/devicecode' -Body @{ client_id = $ClientId; scope = "$EnvUrl/.default offline_access" }
Write-Host ""; Write-Host $dc.message -ForegroundColor Yellow; Write-Host ""
$tok = $null; $until = (Get-Date).AddSeconds($dc.expires_in)
while (-not $tok -and (Get-Date) -lt $until) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try { $tok = Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token' -Body @{ grant_type = 'urn:ietf:params:oauth:grant-type:device_code'; client_id = $ClientId; device_code = $dc.device_code } }
  catch { $e = $null; try { $e = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch {}; if ($e -and $e -ne 'authorization_pending') { throw $_ } }
}
if (-not $tok) { throw 'Sign-in timed out.' }
$H = @{ Authorization = "Bearer $($tok.access_token)"; 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0'; Accept = 'application/json'; 'Content-Type' = 'application/json; charset=utf-8' }
Write-Host 'Signed in.' -ForegroundColor Green

function Call($method, $path, $body, $extra) {
  $h = $H.Clone(); if ($extra) { $extra.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value } }
  $p = @{ Method = $method; Uri = "$Api/$path"; Headers = $h; UseBasicParsing = $true }
  if ($null -ne $body) { $p.Body = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 20 -Compress)) }
  try { return Invoke-WebRequest @p }
  catch {
    $m = $_.ErrorDetails.Message; if (-not $m) { $m = $_.Exception.Message }
    throw "Dataverse $method $path failed: $m"
  }
}
function Get-Json($path) { (Call 'GET' $path $null $null).Content | ConvertFrom-Json }
function Exists($path) { try { $null = Get-Json $path; return $true } catch { if ($_.Exception.Message -match '404|0x80060888|0x80040217|Could not find|does not exist') { return $false } ; throw } }
function Lbl($t) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $t; LanguageCode = 1033 }) } }

# ---------- which table family does this site use? (enhanced data model = mspp_, standard = adx_) ----------
$P = $null
foreach ($cand in 'mspp', 'adx') { if (Exists "EntityDefinitions(LogicalName='${cand}_sitesetting')?`$select=LogicalName") { $P = $cand; break } }
if (-not $P) { throw 'Could not find the Power Pages tables (mspp_sitesetting / adx_sitesetting) in this environment.' }
Write-Host "Using table family: ${P}_*"
$SS = "${P}_sitesettings"; $WR = "${P}_webroles"; $EP = "${P}_entitypermissions"; $WS = "${P}_websites"
$siteBind = "/$WS($WebsiteId)"
if (-not (Exists "$WS($WebsiteId)?`$select=${P}_name")) { throw "Website $WebsiteId not found. Run 'pac pages list' to get the site id." }

# ---------- site settings ----------
function Ensure-Setting($name, $value) {
  $existing = (Get-Json "$SS?`$filter=${P}_name eq '$name' and _${P}_websiteid_value eq $WebsiteId&`$select=${P}_sitesettingid,${P}_value").value
  if ($existing.Count -gt 0) {
    $id = $existing[0].("${P}_sitesettingid")
    if ($existing[0].("${P}_value") -ne $value) { $null = Call 'PATCH' "$SS($id)" @{ "${P}_value" = $value } $null; Write-Host "  updated $name" } else { Write-Host "  ok      $name" }
  } else {
    $null = Call 'POST' $SS @{ "${P}_name" = $name; "${P}_value" = $value; "${P}_websiteid@odata.bind" = $siteBind } $null; Write-Host "  created $name"
  }
}
Write-Host 'Site settings:'
Ensure-Setting 'Webapi/error/innererror' 'true'
Ensure-Setting 'Webapi/cg_incident/enabled' 'true'
Ensure-Setting 'Webapi/cg_incident/fields' 'cg_incidentid,cg_title,cg_reference,cg_severity,cg_status,cg_category,cg_host,cg_account,cg_source,cg_mitre,cg_assignedto,cg_riskscore,cg_description,cg_notes,cg_indicators,cg_timeline,cg_resolvedon,createdon,modifiedon'
Ensure-Setting 'Webapi/cg_contactmessage/enabled' 'true'
Ensure-Setting 'Webapi/cg_contactmessage/fields' 'cg_contactmessageid,cg_name,cg_email,cg_topic,cg_message,createdon'
Ensure-Setting 'Webapi/cg_article/enabled' 'true'
Ensure-Setting 'Webapi/cg_article/fields' 'cg_articleid,cg_title,cg_category,cg_answer,cg_sortorder'

# ---------- web roles ----------
function Get-Role($name) { (Get-Json "$WR?`$filter=${P}_name eq '$name' and _${P}_websiteid_value eq $WebsiteId&`$select=${P}_webroleid").value }
function Ensure-Role($name, $desc) {
  $r = Get-Role $name
  if ($r.Count -gt 0) { return $r[0].("${P}_webroleid") }
  $null = Call 'POST' $WR @{ "${P}_name" = $name; "${P}_description" = $desc; "${P}_websiteid@odata.bind" = $siteBind } $null
  return (Get-Role $name)[0].("${P}_webroleid")
}
Write-Host 'Web roles:'
$analyst = Ensure-Role 'SOC Analyst' 'Can view and manage incidents on the CyberGuard portal'
$auth = (Get-Role 'Authenticated Users'); $anon = (Get-Role 'Anonymous Users')
if ($auth.Count -eq 0 -or $anon.Count -eq 0) { Write-Warning 'Authenticated Users / Anonymous Users roles not found; permissions for them are skipped.' }
$authId = if ($auth.Count) { $auth[0].("${P}_webroleid") } else { $null }
$anonId = if ($anon.Count) { $anon[0].("${P}_webroleid") } else { $null }
Write-Host "  SOC Analyst $analyst"

# ---------- table permissions ----------
$GLOBAL = 756150000
function Ensure-Perm($name, $table, $read, $write, $create, $roles) {
  $ex = (Get-Json "$EP?`$filter=${P}_entityname eq '$name' and _${P}_websiteid_value eq $WebsiteId&`$select=${P}_entitypermissionid").value
  if ($ex.Count -gt 0) { Write-Host "  ok      $name"; return }
  $body = @{ "${P}_entityname" = $name; "${P}_entitylogicalname" = $table; "${P}_scope" = $GLOBAL; "${P}_read" = $read; "${P}_write" = $write; "${P}_create" = $create; "${P}_delete" = $false; "${P}_append" = $false; "${P}_appendto" = $false; "${P}_websiteid@odata.bind" = $siteBind }
  $null = Call 'POST' $EP $body $null
  $id = (Get-Json "$EP?`$filter=${P}_entityname eq '$name' and _${P}_websiteid_value eq $WebsiteId&`$select=${P}_entitypermissionid").value[0].("${P}_entitypermissionid")
  foreach ($r in $roles) { if ($r) { $null = Call 'POST' "$EP($id)/${P}_entitypermission_webrole/`$ref" @{ '@odata.id' = "$Api/$WR($r)" } $null } }
  Write-Host "  created $name"
}
Write-Host 'Table permissions:'
Ensure-Perm 'Incident - SOC analysts manage' 'cg_incident' $true $true $true @($analyst)
Ensure-Perm 'Incident - everyone can report'  'cg_incident' $false $false $true @($authId)
Ensure-Perm 'FAQ articles - read'             'cg_article'  $true $false $false @($authId, $anonId, $analyst)
Ensure-Perm 'Contact messages - send'         'cg_contactmessage' $false $false $true @($authId, $anonId, $analyst)

# ---------- give someone the SOC Analyst role ----------
if ($AssignTo) {
  $c = (Get-Json "contacts?`$filter=emailaddress1 eq '$AssignTo'&`$select=contactid,fullname").value
  if ($c.Count -eq 0) { Write-Warning "No portal contact with email $AssignTo. Sign in to the portal once with that account, then run this again." }
  else {
    $done = $false
    foreach ($rel in "${P}_webrole_contact", "adx_webrole_contact", "mspp_webrole_contact") {
      try { $null = Call 'POST' "contacts($($c[0].contactid))/$rel/`$ref" @{ '@odata.id' = "$Api/$WR($analyst)" } $null; $done = $true; break } catch { if ($_.Exception.Message -match 'duplicate|already exists|0x80040237') { $done = $true; break } }
    }
    if ($done) { Write-Host "Assigned SOC Analyst to $($c[0].fullname)." -ForegroundColor Green }
    else { Write-Warning 'Could not assign the role automatically. In the Portal Management app: Contacts > your contact > Web Roles > add SOC Analyst.' }
  }
}
Write-Host ""
Write-Host 'Done. Wait about a minute (or run Sync configuration from Power Pages > Site actions) and hard refresh the portal.' -ForegroundColor Green
