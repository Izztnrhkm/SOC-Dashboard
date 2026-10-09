<#
 CyberGuard Portal - Dataverse setup
 Creates (idempotently) the tables, columns and sample rows the portal uses:
   cg_incident, cg_contactmessage, cg_article   inside the solution "CyberGuardPortal".
 Run:   .\setup-dataverse.ps1 -EnvUrl https://org5a61f085.crm5.dynamics.com
 You sign in once with a device code (open the link, type the code). Safe to run again.
 Add -SkipSeed to create the tables without sample rows.
#>
param(
  [Parameter(Mandatory = $true)][string]$EnvUrl,
  [switch]$SkipSeed
)
$ErrorActionPreference = 'Stop'
$EnvUrl = $EnvUrl.TrimEnd('/')
$Api = "$EnvUrl/api/data/v9.2"
$Sol = 'CyberGuardPortal'
$Prefix = 'cg'
$ClientId = '51f81489-12ee-4a9e-aaae-a2591f45987d'   # Microsoft public client (same one the Power Platform CLI uses)

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
$SolHdr = @{ 'MSCRM.SolutionUniqueName' = $Sol }

# ---------- publisher + solution ----------
$pub = (Get-Json "publishers?`$filter=customizationprefix eq '$Prefix'&`$select=publisherid,uniquename").value
if ($pub.Count -eq 0) {
  Write-Host 'Creating publisher...'
  $r = Call 'POST' 'publishers' @{ uniquename = 'cyberguard'; friendlyname = 'CyberGuard'; customizationprefix = $Prefix; customizationoptionvalueprefix = 71540 } $null
  $pubId = ([string]$r.Headers["OData-EntityId"] -replace '.*\(|\).*', '')
} else { $pubId = $pub[0].publisherid }
if ((Get-Json "solutions?`$filter=uniquename eq '$Sol'&`$select=solutionid").value.Count -eq 0) {
  Write-Host 'Creating solution...'
  $null = Call 'POST' 'solutions' @{ uniquename = $Sol; friendlyname = 'CyberGuard Portal'; version = '1.0.0.0'; 'publisherid@odata.bind' = "/publishers($pubId)" } $null
}

# ---------- attribute builders ----------
function Str($name, $label, $len = 200, $req = 'None') { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = $req }; MaxLength = $len; FormatName = @{ Value = 'Text' } } }
function Memo($name, $label, $len = 10000) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = 'None' }; MaxLength = $len; Format = 'TextArea' } }
function Int($name, $label, $min = 0, $max = 100) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = 'None' }; MinValue = $min; MaxValue = $max; Format = 'None' } }
function Dt($name, $label) { @{ '@odata.type' = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'; SchemaName = $name; DisplayName = (Lbl $label); RequiredLevel = @{ Value = 'None' }; Format = 'DateAndTime'; DateTimeBehavior = @{ Value = 'UserLocal' } } }

function Ensure-Table($schema, $label, $plural, $primary, $cols) {
  $logical = $schema.ToLower()
  if (-not (Exists "EntityDefinitions(LogicalName='$logical')?`$select=LogicalName")) {
    Write-Host "Creating table $logical..."
    $null = Call 'POST' 'EntityDefinitions' @{
      '@odata.type' = 'Microsoft.Dynamics.CRM.EntityMetadata'; SchemaName = $schema; DisplayName = (Lbl $label); DisplayCollectionName = (Lbl $plural)
      Description = (Lbl "$label (CyberGuard Portal)"); OwnershipType = 'UserOwned'; HasActivities = $false; HasNotes = $false; IsActivity = $false
      Attributes = @($primary)
    } $SolHdr
  } else { Write-Host "Table $logical exists." }
  foreach ($c in $cols) {
    $ln = $c.SchemaName.ToLower()
    if (-not (Exists "EntityDefinitions(LogicalName='$logical')/Attributes(LogicalName='$ln')?`$select=LogicalName")) {
      Write-Host "  + $ln"
      $null = Call 'POST' "EntityDefinitions(LogicalName='$logical')/Attributes" $c $SolHdr
    }
  }
}

# ---------- tables ----------
$incPrimary = Str 'cg_Title' 'Title' 200 'ApplicationRequired'; $incPrimary.IsPrimaryName = $true
$incRef = Str 'cg_Reference' 'Reference' 50; $incRef.AutoNumberFormat = 'INC-{DATETIMEUTC:yyyy}-{SEQNUM:4}'
Ensure-Table 'cg_Incident' 'Incident' 'Incidents' $incPrimary @(
  $incRef, (Str 'cg_Severity' 'Severity' 20), (Str 'cg_Status' 'Status' 20), (Str 'cg_Category' 'Category' 100), (Str 'cg_Host' 'Host' 200),
  (Str 'cg_Account' 'Account' 200), (Str 'cg_Source' 'Detected by' 100), (Str 'cg_Mitre' 'MITRE technique' 200), (Str 'cg_AssignedTo' 'Assigned to' 200),
  (Int 'cg_RiskScore' 'Risk score' 0 100), (Memo 'cg_Description' 'Description'), (Memo 'cg_Notes' 'Notes'),
  (Memo 'cg_Indicators' 'Indicators (one per line)'), (Memo 'cg_Timeline' 'Timeline (time | event per line)'), (Dt 'cg_ResolvedOn' 'Resolved on'))

$msgPrimary = Str 'cg_Name' 'Name' 200 'ApplicationRequired'; $msgPrimary.IsPrimaryName = $true
Ensure-Table 'cg_ContactMessage' 'Contact message' 'Contact messages' $msgPrimary @((Str 'cg_Email' 'Email' 200), (Str 'cg_Topic' 'Topic' 200), (Memo 'cg_Message' 'Message' 4000))

$artPrimary = Str 'cg_Title' 'Question' 300 'ApplicationRequired'; $artPrimary.IsPrimaryName = $true
Ensure-Table 'cg_Article' 'FAQ article' 'FAQ articles' $artPrimary @((Str 'cg_Category' 'Category' 100), (Memo 'cg_Answer' 'Answer' 6000), (Int 'cg_SortOrder' 'Sort order' 0 9999))

# ---------- sample data ----------
if (-not $SkipSeed) {
  $data = @'
{
 "incidents": [
  {
   "ref": "INC-2026-8941",
   "title": "Ransomware Pre-Execution: Cobalt Strike Beaconing Detected",
   "sev": "critical",
   "status": "investigating",
   "cat": "Ransomware / C2",
   "mitre": "T1071.001 Web Protocols",
   "host": "FIN-DB-SVR01",
   "account": "r.henderson@cyberguard.internal",
   "src": "Defender XDR",
   "owner": "Jessica Lee (CISO / Lead)",
   "risk": 96,
   "desc": "Suspicious HTTPS traffic beaconing in regular 45s intervals to known adversary C2 IP (185.220.101.44). Cobalt Strike malleable C2 profile identified by EDR behavioral monitor.",
   "ind": "185.220.101.44 (C2 Remote IP)\nhash: 4e8b34f8a846c4f901174092d6e4917b2e3e5c9b687f87a32d1840ab7183e8fa\nprocess: powershell.exe -enc SQBFAFgA...",
   "tl": "14:18:02 UTC | PowerShell spawned with hidden base64 encoded parameters.\n14:18:15 UTC | Outbound TLS session established to untrusted IP 185.220.101.44.\n14:18:40 UTC | Defender XDR triggered Sev-1 alert; memory scan confirmed Cobalt Strike stager.",
   "agoMin": 4,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8940",
   "title": "Active Kerberoasting & Service Ticket Harvesting Spike",
   "sev": "critical",
   "status": "new",
   "cat": "Privilege Escalation",
   "mitre": "T1558.003 Kerberoasting",
   "host": "DC-CORP-01",
   "account": "svc_backup_agent",
   "src": "Azure Sentinel",
   "owner": "Unassigned",
   "risk": 92,
   "desc": "Excessive Kerberos TGS requests (over 180 requests in 90 seconds) for service accounts with RC4 encryption. Possible offline hash cracking attempt in progress.",
   "ind": "Event ID: 4769 (Audit Kerberos Service Ticket Operations)\nTarget SPN: MSSQLSvc/sql-prod.cyberguard.internal:1433\nEncryption: 0x17 (RC4-HMAC weak cipher requested)",
   "tl": "14:11:10 UTC | Spike of Kerberos TGS ticket queries originating from WKS-DEV-08.\n14:12:00 UTC | Sentinel analytics rule 'Kerberoasting Pattern Detection' fired.",
   "agoMin": 11,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8939",
   "title": "Potential Data Exfiltration via Encrypted DNS Tunneling",
   "sev": "critical",
   "status": "investigating",
   "cat": "Exfiltration",
   "mitre": "T1048.003 DNS Tunneling",
   "host": "RND-WS-204",
   "account": "d.chen@cyberguard.internal",
   "src": "Palo Alto NGFW",
   "owner": "David Martinez",
   "risk": 88,
   "desc": "High volume of abnormal TXT and null DNS record queries directed to rogue nameserver ns1.darkrelay-sync.cc. Payload inspection indicates compressed document exfiltration.",
   "ind": "ns1.darkrelay-sync.cc (Rogue NS)\nQueries: 14,200 requests / 15 mins\nAverage Query Length: 182 characters",
   "tl": "13:58:12 UTC | DNS query volume surged 800% above baseline.\n14:02:18 UTC | Network firewall flagged tunneling signature; host auto-quarantined.",
   "agoMin": 23,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8938",
   "title": "Credential Stuffing / Password Spray on Entra ID Admin Portal",
   "sev": "high",
   "status": "investigating",
   "cat": "Initial Access",
   "mitre": "T1110.003 Password Spraying",
   "host": "ENTRA-ID-TENANT",
   "account": "Multiple (42 Accounts)",
   "src": "Azure Sentinel",
   "owner": "David Martinez",
   "risk": 79,
   "desc": "Distributed IP network attempting low-and-slow authentication against cloud accounts using common passwords. 3 accounts triggered Risk State 'High'.",
   "ind": "194.26.29.11 (TOR Exit Node)\nUser-Agent: python-requests/2.28\nFailed Sign-ins: 384 attempts across 42 identities",
   "tl": "13:45:00 UTC | Initial wave of login failures detected across multiple departments.\n13:50:00 UTC | Identity Protection elevated user risk; Conditional Access enforced MFA.",
   "agoMin": 34,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8937",
   "title": "LSASS Memory Dump via MiniDumpWriteDump API",
   "sev": "high",
   "status": "contained",
   "cat": "Credential Access",
   "mitre": "T1003.001 LSASS Memory",
   "host": "HR-PAYROLL-02",
   "account": "m.adams@cyberguard.internal",
   "src": "CrowdStrike Falcon",
   "owner": "Monica Patel",
   "risk": 84,
   "desc": "Unsigned binary attempted to read credentials from Local Security Authority Subsystem Service (LSASS) process memory. Blocked in pre-execution by kernel driver.",
   "ind": "File: C:\\Users\\Public\\dbgmon.exe\nHash: b1946ac92492d2347c6235b4d2611184\nTarget Process: lsass.exe (PID 628)",
   "tl": "13:30:14 UTC | Host accessed malicious phishing macro attachment.\n13:31:02 UTC | dbgmon.exe dropped into Public folder and executed.\n13:31:04 UTC | Falcon blocked memory access; host network isolated.",
   "agoMin": 48,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8936",
   "title": "Scheduled Task Persistence Created in System32",
   "sev": "high",
   "status": "investigating",
   "cat": "Persistence",
   "mitre": "T1053.005 Scheduled Task",
   "host": "APP-SVR-PROD04",
   "account": "SYSTEM",
   "src": "Defender XDR",
   "owner": "Jessica Lee (CISO / Lead)",
   "risk": 76,
   "desc": "Hidden scheduled task registered with SYSTEM privileges configured to run a PowerShell reverse shell every 60 minutes upon reboot.",
   "ind": "Task Name: \\Microsoft\\Windows\\Maintenance\\WinUpdaterService\nAction: wscript.exe C:\\ProgramData\\svchost.vbs",
   "tl": "13:08:00 UTC | Schtasks command invoked from cmd.exe under admin context.",
   "agoMin": 70,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8935",
   "title": "Phishing BEC: Suspicious Mail Forwarding Rule Created",
   "sev": "medium",
   "status": "investigating",
   "cat": "Initial Access",
   "mitre": "T1114.003 Email Forwarding Rule",
   "host": "EXCHANGE-ONLINE",
   "account": "cfo-exec@cyberguard.internal",
   "src": "Defender XDR",
   "owner": "Monica Patel",
   "risk": 68,
   "desc": "Inbox forwarding rule 'AutoArchive' created to forward all messages containing 'Invoice', 'Wire', or 'Payment' to external inbox audit-financials@protonmail.com.",
   "ind": "Forwarding Address: audit-financials@protonmail.com\nRule Name: AutoArchive\nIP of modification: 82.102.23.4 (Romania)",
   "tl": "12:45:00 UTC | Account accessed from unusual geography without active VPN.\n12:46:12 UTC | New-InboxRule cmdlet executed; alert fired in Defender for Office 365.",
   "agoMin": 95,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8934",
   "title": "Unauthorized Port Scan on Internal DMZ Subnet",
   "sev": "medium",
   "status": "contained",
   "cat": "Discovery",
   "mitre": "T1046 Network Service Discovery",
   "host": "DMZ-GW-01",
   "account": "N/A (Network Device)",
   "src": "Palo Alto NGFW",
   "owner": "David Martinez",
   "risk": 62,
   "desc": "SYN scan targeting ports 22, 80, 443, 3389, 445 across 254 internal IP addresses. Source host was a misconfigured contractor laptop.",
   "ind": "Source: 10.50.1.84 (Contractor-VLAN)\nRate: 4,000 packets/sec",
   "tl": "12:05:00 UTC | Firewall IPS tripped SYN flood & scan signature; port blocked at switch.",
   "agoMin": 135,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8933",
   "title": "Outdated OpenSSL Vulnerability Probe (CVE-2023-3817)",
   "sev": "low",
   "status": "resolved",
   "cat": "Vulnerability",
   "mitre": "T1190 Exploit Public-Facing App",
   "host": "WEB-PROXY-EXT",
   "account": "Anonymous Web Traffic",
   "src": "Cloudflare WAF",
   "owner": "SOC Auto-Remediation",
   "risk": 35,
   "desc": "Automated vulnerability scanner probed public SSL handshake for DH parameter flaws. Automatically dropped at Cloudflare Edge.",
   "ind": "Scanner IP: 45.154.255.80\nWAF Rule: 100048 (SSL Attack Signature)",
   "tl": "10:40:00 UTC | Probe blocked by edge rule; zero internal impact.",
   "agoMin": 220,
   "fixMin": 0
  },
  {
   "ref": "INC-2026-8900",
   "title": "Phishing campaign targeting finance mailboxes",
   "sev": "high",
   "status": "resolved",
   "cat": "Initial Access",
   "mitre": "",
   "host": "EXCHANGE-ONLINE",
   "account": "",
   "src": "Defender XDR",
   "owner": "David Martinez",
   "risk": 25,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 1440,
   "fixMin": 6
  },
  {
   "ref": "INC-2026-8899",
   "title": "Suspicious OAuth app consent granted",
   "sev": "medium",
   "status": "resolved",
   "cat": "Persistence",
   "mitre": "",
   "host": "ENTRA-ID-TENANT",
   "account": "",
   "src": "Azure Sentinel",
   "owner": "Monica Patel",
   "risk": 32,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 1577,
   "fixMin": 17
  },
  {
   "ref": "INC-2026-8898",
   "title": "Malware blocked on endpoint",
   "sev": "low",
   "status": "resolved",
   "cat": "Execution",
   "mitre": "",
   "host": "HR-LT-117",
   "account": "",
   "src": "CrowdStrike Falcon",
   "owner": "Jessica Lee (CISO / Lead)",
   "risk": 39,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 3154,
   "fixMin": 28
  },
  {
   "ref": "INC-2026-8897",
   "title": "Port scan against public web tier",
   "sev": "low",
   "status": "resolved",
   "cat": "Discovery",
   "mitre": "",
   "host": "WAF-EDGE-02",
   "account": "",
   "src": "Palo Alto NGFW",
   "owner": "David Martinez",
   "risk": 46,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 3291,
   "fixMin": 39
  },
  {
   "ref": "INC-2026-8896",
   "title": "Impossible travel sign-in detected",
   "sev": "medium",
   "status": "resolved",
   "cat": "Initial Access",
   "mitre": "",
   "host": "ENTRA-ID-TENANT",
   "account": "",
   "src": "Azure Sentinel",
   "owner": "Monica Patel",
   "risk": 53,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 4868,
   "fixMin": 12
  },
  {
   "ref": "INC-2026-8895",
   "title": "Unsigned driver loaded on server",
   "sev": "high",
   "status": "resolved",
   "cat": "Defense Evasion",
   "mitre": "",
   "host": "APP-SVR-PROD02",
   "account": "",
   "src": "Defender XDR",
   "owner": "Jessica Lee (CISO / Lead)",
   "risk": 60,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 4405,
   "fixMin": 23
  },
  {
   "ref": "INC-2026-8894",
   "title": "Brute-force against VPN gateway",
   "sev": "medium",
   "status": "resolved",
   "cat": "Credential Access",
   "mitre": "",
   "host": "VPN-GW-01",
   "account": "",
   "src": "Palo Alto NGFW",
   "owner": "David Martinez",
   "risk": 67,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 5982,
   "fixMin": 34
  },
  {
   "ref": "INC-2026-8893",
   "title": "USB mass storage on restricted laptop",
   "sev": "low",
   "status": "resolved",
   "cat": "Exfiltration",
   "mitre": "",
   "host": "SEC-OPS-LAPTOP02",
   "account": "",
   "src": "CrowdStrike Falcon",
   "owner": "Monica Patel",
   "risk": 74,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 6119,
   "fixMin": 7
  },
  {
   "ref": "INC-2026-8892",
   "title": "Web shell upload attempt",
   "sev": "critical",
   "status": "resolved",
   "cat": "Persistence",
   "mitre": "",
   "host": "WEB-DMZ-03",
   "account": "",
   "src": "Defender XDR",
   "owner": "Jessica Lee (CISO / Lead)",
   "risk": 26,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 7696,
   "fixMin": 18
  },
  {
   "ref": "INC-2026-8891",
   "title": "Anomalous data download from SharePoint",
   "sev": "high",
   "status": "resolved",
   "cat": "Collection",
   "mitre": "",
   "host": "SPO-TENANT",
   "account": "",
   "src": "Azure Sentinel",
   "owner": "David Martinez",
   "risk": 33,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 7233,
   "fixMin": 29
  },
  {
   "ref": "INC-2026-8890",
   "title": "Suspicious C2 domain beaconing",
   "sev": "high",
   "status": "resolved",
   "cat": "Command and Control",
   "mitre": "",
   "host": "DEV-BUILD-04",
   "account": "",
   "src": "Defender XDR",
   "owner": "Monica Patel",
   "risk": 40,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 8810,
   "fixMin": 40
  },
  {
   "ref": "INC-2026-8889",
   "title": "Multi-account password spray",
   "sev": "high",
   "status": "resolved",
   "cat": "Credential Access",
   "mitre": "",
   "host": "ENTRA-ID-TENANT",
   "account": "",
   "src": "Azure Sentinel",
   "owner": "Jessica Lee (CISO / Lead)",
   "risk": 47,
   "desc": "Closed after investigation. No further action required.",
   "ind": "",
   "tl": "",
   "agoMin": 8947,
   "fixMin": 13
  }
 ],
 "articles": [
  {
   "title": "Where can I find the incident response playbooks?",
   "category": "Incidents",
   "answer": "Open Incident response from the menu. Playbooks for ransomware, account takeover and phishing are listed there with tick-off checklists.",
   "sort": 1
  },
  {
   "title": "Can I use the portal on my phone?",
   "category": "General",
   "answer": "Yes. Every page works on phones and tablets. The incident table turns into cards on small screens.",
   "sort": 2
  },
  {
   "title": "How do I get the weekly SOC summary?",
   "category": "Reports",
   "answer": "Open Reports, find Weekly SOC summary and choose Request copy. The team will email it to you.",
   "sort": 3
  }
 ]
}
'@ | ConvertFrom-Json
  $have = (Get-Json 'cg_incidents?$select=cg_reference&$top=500').value | ForEach-Object { $_.cg_reference }
  $n = 0
  foreach ($i in $data.incidents) {
    if ($have -contains $i.ref) { continue }
    $created = (Get-Date).ToUniversalTime().AddMinutes(-$i.agoMin)
    $row = @{
      cg_title = $i.title; cg_reference = $i.ref; cg_severity = $i.sev; cg_status = $i.status; cg_category = $i.cat; cg_mitre = $i.mitre; cg_host = $i.host; cg_account = $i.account
      cg_source = $i.src; cg_assignedto = $i.owner; cg_riskscore = [int]$i.risk; cg_description = $i.desc; cg_indicators = $i.ind; cg_timeline = $i.tl
      overriddencreatedon = $created.ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
    if ($i.status -eq 'resolved') { $row.cg_resolvedon = $created.AddMinutes($i.fixMin).ToString('yyyy-MM-ddTHH:mm:ssZ') }
    $null = Call 'POST' 'cg_incidents' $row $null; $n++
  }
  Write-Host "Seeded $n incidents."
  $haveA = (Get-Json 'cg_articles?$select=cg_title&$top=200').value | ForEach-Object { $_.cg_title }
  $m = 0
  foreach ($a in $data.articles) { if ($haveA -contains $a.title) { continue }; $null = Call 'POST' 'cg_articles' @{ cg_title = $a.title; cg_category = $a.category; cg_answer = $a.answer; cg_sortorder = [int]$a.sort } $null; $m++ }
  Write-Host "Seeded $m FAQ articles."
}

# ---------- publish ----------
Write-Host 'Publishing customizations...'
$null = Call 'POST' 'PublishAllXml' @{} $null
Write-Host ""
Write-Host 'Done. Tables: cg_incident, cg_contactmessage, cg_article' -ForegroundColor Green
Write-Host 'Entity set names used by the portal: cg_incidents, cg_contactmessages, cg_articles'
Write-Host 'Next: follow SETUP.md section 2 (site settings, web roles, table permissions).'
