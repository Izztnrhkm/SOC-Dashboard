<#
 Landasan Digital SOC Portal - setup for v4 (run once; safe to run again).
 It does four things and prints a check for each:
   1. Creates the tables for the new pages: cg_handover (Shift handover) and cg_indicator (Watchlist).
   2. Turns on the Web API for them (site settings).
   3. Creates table permissions for them.
   4. Links every portal table permission to its web roles, then reads the links back to prove they saved.
      (The earlier scripts linked roles in a way Power Pages does not show. This one uses the relationship
       that Power Pages itself uses, and tells you exactly what to click if it still cannot.)
 Run:
   & ".\setup-portal-v4.ps1" -EnvUrl https://org5a61f085.crm5.dynamics.com -WebsiteId 36e7a73f-f9fd-4219-ad99-31ae7dfb6aab
#>
param(
  [Parameter(Mandatory = $true)][string]$EnvUrl,
  [Parameter(Mandatory = $true)][string]$WebsiteId
)
$ErrorActionPreference = 'Stop'
$EnvUrl = $EnvUrl.TrimEnd('/')
$Api = "$EnvUrl/api/data/v9.2"
$ClientId = '51f81489-12ee-4a9e-aaae-a2591f45987d'
$Sol = 'CyberGuardPortal'

# ---------- sign in (device code) ----------
$dc = Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/devicecode' -Body @{ client_id = $ClientId; scope = "$EnvUrl/.default offline_access" }
Write-Host ''; Write-Host $dc.message -ForegroundColor Yellow; Write-Host ''
$tok = $null; $until = (Get-Date).AddSeconds($dc.expires_in)
while (-not $tok -and (Get-Date) -lt $until) {
  Start-Sleep -Seconds ([int]$dc.interval)
  try { $tok = Invoke-RestMethod -Method Post -Uri 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token' -Body @{ grant_type = 'urn:ietf:params:oauth:grant-type:device_code'; client_id = $ClientId; device_code = $dc.device_code } }
  catch { $e = $null; try { $e = ($_.ErrorDetails.Message | ConvertFrom-Json).error } catch {}; if ($e -and $e -ne 'authorization_pending' -and $e -ne 'slow_down') { throw $_ } }
}
if (-not $tok) { throw 'Sign-in timed out.' }
$H = @{ Authorization = "Bearer $($tok.access_token)"; 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0'; Accept = 'application/json'; 'Content-Type' = 'application/json; charset=utf-8' }
Write-Host 'Signed in.' -ForegroundColor Green

# ---------- helpers ----------
function Call($method, $path, $body, $extra) {
  $h = $H.Clone(); if ($extra) { $extra.GetEnumerator() | ForEach-Object { $h[$_.Key] = $_.Value } }
  $p = @{ Method = $method; Uri = "$Api/$path"; Headers = $h; UseBasicParsing = $true }
  if ($null -ne $body) { $p.Body = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 20 -Compress)) }
  try { return Invoke-WebRequest @p }
  catch {
    $m = $_.ErrorDetails.Message; if (-not $m) { $m = $_.Exception.Message }
    $code = ''; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    $m = ($m -replace '(?s)<style.*?</style>', '' -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim(); if ($m.Length -gt 300) { $m = $m.Substring(0, 300) }
    throw "($code) $m"
  }
}
function Get-Json($path) { (Call 'GET' $path $null $null).Content | ConvertFrom-Json }
function Get-All($set) { $out = @(); $u = $set; while ($u) { $r = Get-Json $u; $out += @($r.value); $u = $null; if ($r.'@odata.nextLink') { $u = $r.'@odata.nextLink'.Substring($Api.Length + 1) } }; return $out }
function Exists($path) { try { $null = Get-Json $path; return $true } catch { if ($_.Exception.Message -match '\(404\)|0x80060888|0x80040217|Could not find|does not exist') { return $false }; throw } }
function Lbl($t) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'; LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $t; LanguageCode = 1033 }) } }
function Str($name, $label, $len, $req) { if (-not $req) { $req = 'None' }; @{ '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = $req }; MaxLength = $len; FormatName = @{ Value = 'Text' } } }
function Memo($name, $label, $len) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = 'None' }; MaxLength = $len; Format = 'TextArea' } }
function Dt($name, $label) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = 'None' }; Format = 'DateAndTime'; DateTimeBehavior = @{ Value = 'UserLocal' } } }
$SolHdr = @{ 'MSCRM.SolutionUniqueName' = $Sol }
$problems = @()

# ---------- 1. tables ----------
function Ensure-Table($schema, $label, $plural, $primary, $cols) {
  $logical = $schema.ToLower()
  if (-not (Exists "EntityDefinitions(LogicalName='$logical')?`$select=LogicalName")) {
    Write-Host "  creating table $logical (takes a minute)..."
    $null = Call 'POST' 'EntityDefinitions' @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.EntityMetadata'; SchemaName = $schema; DisplayName = (Lbl $label); DisplayCollectionName = (Lbl $plural)
      Description = (Lbl "$label (SOC Portal)"); OwnershipType = 'UserOwned'; HasActivities = $false; HasNotes = $false; IsActivity = $false
      Attributes = @($primary)
    } $SolHdr
  } else { Write-Host "  ok      table $logical" }
  foreach ($c in $cols) {
    $ln = $c.SchemaName.ToLower()
    if (-not (Exists "EntityDefinitions(LogicalName='$logical')/Attributes(LogicalName='$ln')?`$select=LogicalName")) { Write-Host "    + $ln"; $null = Call 'POST' "EntityDefinitions(LogicalName='$logical')/Attributes" $c $SolHdr }
  }
  $set = (Get-Json "EntityDefinitions(LogicalName='$logical')?`$select=EntitySetName").EntitySetName
  Write-Host "          Web API name: $set"
  return $set
}
Write-Host ''; Write-Host '1. Tables' -ForegroundColor Cyan
$hoPrimary = Str 'cg_Title' 'Shift' 100 'ApplicationRequired'; $hoPrimary.IsPrimaryName = $true
$hoSet = Ensure-Table 'cg_Handover' 'Shift handover' 'Shift handovers' $hoPrimary @((Memo 'cg_Summary' 'What happened' 4000), (Memo 'cg_OpenItems' 'Still open' 4000), (Memo 'cg_Watch' 'Keep an eye on' 4000), (Str 'cg_Author' 'Written by' 200), (Str 'cg_HandedTo' 'Handed to' 200))
$ioPrimary = Str 'cg_Value' 'Indicator' 850 'ApplicationRequired'; $ioPrimary.IsPrimaryName = $true
$ioSet = Ensure-Table 'cg_Indicator' 'Watchlist indicator' 'Watchlist indicators' $ioPrimary @((Str 'cg_Type' 'Type' 30), (Str 'cg_Action' 'Action' 30), (Memo 'cg_Reason' 'Reason' 2000), (Dt 'cg_ExpiresOn' 'Expires on'), (Str 'cg_AddedBy' 'Added by' 200), (Str 'cg_IncidentRef' 'Incident' 50))
if ($hoSet -ne 'cg_handovers') { $problems += "The handover table's Web API name is $hoSet, not cg_handovers. Tell Claude." }
if ($ioSet -ne 'cg_indicators') { $problems += "The watchlist table's Web API name is $ioSet, not cg_indicators. Tell Claude." }

# ---------- which Power Pages table family ----------
$P = $null
foreach ($cand in 'mspp', 'adx') { if (Exists "EntityDefinitions(LogicalName='${cand}_sitesetting')?`$select=LogicalName") { $P = $cand; break } }
if (-not $P) { throw 'Power Pages tables not found in this environment.' }
$SS = "${P}_sitesettings"; $WR = "${P}_webroles"; $EP = "${P}_entitypermissions"; $siteBind = "/${P}_websites($WebsiteId)"

# ---------- 2. site settings ----------
Write-Host ''; Write-Host '2. Web API site settings' -ForegroundColor Cyan
$allSS = @(Get-All $SS | Where-Object { $_.("_${P}_websiteid_value") -eq $WebsiteId })
function Ensure-Setting($name, $value) {
  $ex = @($allSS | Where-Object { $_.("${P}_name") -eq $name })
  if ($ex.Count -gt 0) {
    if ($ex[0].("${P}_value") -ne $value) { $null = Call 'PATCH' "$SS($($ex[0].("${P}_sitesettingid")))" @{ "${P}_value" = $value } $null; Write-Host "  updated $name" } else { Write-Host "  ok      $name" }
  } else { $null = Call 'POST' $SS @{ "${P}_name" = $name; "${P}_value" = $value; "${P}_websiteid@odata.bind" = $siteBind } $null; Write-Host "  created $name" }
}
Ensure-Setting 'Webapi/cg_handover/enabled' 'true'
Ensure-Setting 'Webapi/cg_handover/fields' 'cg_handoverid,cg_title,cg_summary,cg_openitems,cg_watch,cg_author,cg_handedto,createdon'
Ensure-Setting 'Webapi/cg_indicator/enabled' 'true'
Ensure-Setting 'Webapi/cg_indicator/fields' 'cg_indicatorid,cg_value,cg_type,cg_action,cg_reason,cg_expireson,cg_addedby,cg_incidentref,createdon'

# ---------- roles ----------
$roles = @(Get-All $WR | Where-Object { $_.("_${P}_websiteid_value") -eq $WebsiteId })
function RoleIds($n) { @($roles | Where-Object { $_.("${P}_name") -eq $n } | ForEach-Object { $_.("${P}_webroleid") }) }
$analysts = @(RoleIds 'SOC Analyst'); $auth = @(RoleIds 'Authenticated Users'); $anon = @(RoleIds 'Anonymous Users')
if ($analysts.Count -eq 0) { throw 'No "SOC Analyst" web role found for this website.' }
if ($analysts.Count -gt 1) { Write-Host "  note: $($analysts.Count) roles are named SOC Analyst; permissions are linked to all of them." -ForegroundColor Yellow }

# ---------- 3. table permissions ----------
Write-Host ''; Write-Host '3. Table permissions' -ForegroundColor Cyan
$GLOBAL = 756150000
$allEP = @(Get-All $EP | Where-Object { $_.("_${P}_websiteid_value") -eq $WebsiteId })
function Ensure-Perm($name, $table, $read, $write, $create, $delete) {
  $ex = @($allEP | Where-Object { $_.("${P}_entityname") -eq $name })
  if ($ex.Count -gt 0) {
    $x = $ex[0]; $fix = @{}
    if ($x.("${P}_entitylogicalname") -ne $table) { $fix["${P}_entitylogicalname"] = $table }
    foreach ($k in @(@('read', $read), @('write', $write), @('create', $create), @('delete', $delete))) { if ([bool]$x.("${P}_" + $k[0]) -ne [bool]$k[1]) { $fix["${P}_" + $k[0]] = $k[1] } }
    if ([int]$x.("${P}_scope") -ne $GLOBAL) { $fix["${P}_scope"] = $GLOBAL }
    if ($fix.Count -gt 0) { $null = Call 'PATCH' "$EP($($x.("${P}_entitypermissionid")))" $fix $null; Write-Host "  fixed   $name ($(@($fix.Keys) -join ', '))" } else { Write-Host "  ok      $name" }
    return
  }
  $body = @{ "${P}_entityname" = $name; "${P}_entitylogicalname" = $table; "${P}_scope" = $GLOBAL; "${P}_read" = $read; "${P}_write" = $write; "${P}_create" = $create; "${P}_delete" = $delete; "${P}_append" = $false; "${P}_appendto" = $false; "${P}_websiteid@odata.bind" = $siteBind }
  $null = Call 'POST' $EP $body $null; Write-Host "  created $name"
}
Ensure-Perm 'Incident - SOC analysts manage' 'cg_incident' $true $true $true $false
Ensure-Perm 'Incident - everyone can report' 'cg_incident' $false $false $true $false
Ensure-Perm 'FAQ articles - read' 'cg_article' $true $false $false $false
Ensure-Perm 'Contact messages - send' 'cg_contactmessage' $false $false $true $false
Ensure-Perm 'Handover - SOC analysts' 'cg_handover' $true $true $true $false
Ensure-Perm 'Watchlist - SOC analysts' 'cg_indicator' $true $true $true $true
$allEP = @(Get-All $EP | Where-Object { $_.("_${P}_websiteid_value") -eq $WebsiteId })

# which roles each permission needs
$want = [ordered]@{
  'Incident - SOC analysts manage' = $analysts
  'Incident - everyone can report' = $auth
  'FAQ articles - read'            = @(@($auth) + @($anon) + @($analysts))
  'Contact messages - send'        = @(@($auth) + @($anon) + @($analysts))
  'Handover - SOC analysts'        = $analysts
  'Watchlist - SOC analysts'       = $analysts
}

# ---------- 4. link roles the way Power Pages stores them ----------
Write-Host ''; Write-Host '4. Linking web roles to table permissions' -ForegroundColor Cyan
# In the enhanced data model, permissions and roles are rows of powerpagecomponent, linked to each other
# through a many-to-many relationship of powerpagecomponent with itself. Find it.
if ($P -ne 'mspp') { throw 'This site uses the standard data model (adx_). Add the roles by hand: see the list at the end of SETUP.md.' }
$rels = @((Get-Json "EntityDefinitions(LogicalName='powerpagecomponent')/ManyToManyRelationships?`$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName").value |
  Where-Object { $_.Entity1LogicalName -eq 'powerpagecomponent' -and $_.Entity2LogicalName -eq 'powerpagecomponent' })
if ($rels.Count -eq 0) { $problems += 'No powerpagecomponent self-relationship was found, so roles could not be linked automatically.' }
foreach ($r in $rels) { Write-Host ("  relationship {0}: {1} / {2}" -f $r.SchemaName, $r.Entity1NavigationPropertyName, $r.Entity2NavigationPropertyName) }
$navs = @(); foreach ($r in $rels) { $navs += $r.Entity1NavigationPropertyName; if ($r.Entity2NavigationPropertyName -ne $r.Entity1NavigationPropertyName) { $navs += $r.Entity2NavigationPropertyName } }

function Linked($permId, $nav) {
  $ids = @(); $list = $navs; if ($nav) { $list = @($nav) }
  foreach ($n in $list) { try { $ids += @((Get-Json "powerpagecomponents($permId)/$n`?`$select=powerpagecomponentid").value | ForEach-Object { $_.powerpagecomponentid }) } catch {} }
  return $ids
}
foreach ($name in $want.Keys) {
  $perm = @($allEP | Where-Object { $_.("${P}_entityname") -eq $name })
  if ($perm.Count -eq 0) { Write-Host "  skip    $name (not found)" -ForegroundColor Yellow; continue }
  $pid_ = $perm[0].("${P}_entitypermissionid")
  $need = @(@($want[$name]) | Where-Object { $_ } | Select-Object -Unique)
  $have = @(Linked $pid_)
  $usedNav = $null
  foreach ($role in $need) {
    if ($have -contains $role) { continue }
    $ok = $false; $last = ''
    foreach ($n in $navs) {
      try { $null = Call 'POST' "powerpagecomponents($pid_)/$n/`$ref" @{ '@odata.id' = "$Api/powerpagecomponents($role)" } $null; $ok = $true; $usedNav = $n; break }
      catch { if ($_.Exception.Message -match 'duplicate|already exists|0x80040237|0x80060892') { $ok = $true; break } else { $last = $_.Exception.Message } }
    }
    if (-not $ok) { Write-Host "    could not link role $role : $last" -ForegroundColor Yellow }
  }
  $have = @(Linked $pid_ $usedNav)
  $missing = @($need | Where-Object { $have -notcontains $_ })
  $names = @($roles | Where-Object { $have -contains $_.("${P}_webroleid") } | ForEach-Object { $_.("${P}_name") }) -join ', '
  if ($need.Count -eq 0) { Write-Host "  FAIL    ${name}: no roles to link" -ForegroundColor Red; $problems += "No roles found for '$name'."; continue }
  $via = ''; if ($usedNav) { $via = " (via $usedNav)" }
  if ($missing.Count -eq 0) { Write-Host ("  PASS    {0}: {1}{2}" -f $name, $names, $via) -ForegroundColor Green }
  else { Write-Host ("  FAIL    {0}: {1} of {2} roles linked" -f $name, ($need.Count - $missing.Count), $need.Count) -ForegroundColor Red; $problems += "Roles missing on '$name'." }
}

# ---------- summary ----------
Write-Host ''
if ($problems.Count -eq 0) {
  Write-Host 'All steps passed.' -ForegroundColor Green
} else {
  Write-Host 'Finished with problems:' -ForegroundColor Red
  $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
Write-Host ''
Write-Host 'Now check: Power Pages > Security > Table permissions. The Roles column must show a role on every row.' -ForegroundColor Cyan
Write-Host 'If any row still shows "--", add the roles by hand (open the permission > Roles > add > Save):' -ForegroundColor Yellow
if ($true) {
  Write-Host '  Incident - SOC analysts manage : SOC Analyst'
  Write-Host '  Incident - everyone can report : Authenticated Users'
  Write-Host '  FAQ articles - read            : Authenticated Users, Anonymous Users, SOC Analyst'
  Write-Host '  Contact messages - send        : Authenticated Users, Anonymous Users, SOC Analyst'
  Write-Host '  Handover - SOC analysts        : SOC Analyst'
  Write-Host '  Watchlist - SOC analysts       : SOC Analyst'
}
Write-Host 'Then click Sync in Power Pages and hard refresh the portal (Ctrl+F5).'
