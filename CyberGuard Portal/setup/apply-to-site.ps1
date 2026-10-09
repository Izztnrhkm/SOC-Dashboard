<#
 Copies the redesigned portal files from this repository into a site folder downloaded with
 `pac pages download`, using the real folder layout, so `pac pages upload` publishes them.
 Run:  .\apply-to-site.ps1 -Site "C:\Users\izzat\Documents\cyberguard-site\cyberguard-portal---cyberguardportal-d71d"
 (-Site is the folder that contains web-pages, web-templates, web-files ...). A backup copy is not made: keep your earlier download.
#>
param([Parameter(Mandatory = $true)][string]$Site)
$ErrorActionPreference = 'Stop'
$Repo = Join-Path (Split-Path -Parent $PSScriptRoot) '.'
$Repo = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
if (-not (Test-Path -LiteralPath (Join-Path $Site 'web-pages'))) { throw "No web-pages folder in $Site. Point -Site at the downloaded site folder." }
$n = 0
function Put($from, $to) {
  if (-not (Test-Path -LiteralPath $from)) { Write-Warning "missing source: $from"; return }
  $dir = Split-Path -Parent $to
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item -LiteralPath $from -Destination $to -Force; $script:n++
}
# theme
Put (Join-Path $Repo 'web-files\theme.css') (Join-Path $Site 'web-files\theme.css')
# templates: repo name -> folder slug / base name
$tpl = @(
  @('Header', 'header', 'Header'), @('Footer', 'footer', 'Footer'), @('Search Results', 'search-results', 'Search-Results'),
  @('Layout 2 Column Wide Left', 'layout-2-column-wide-left', 'Layout-2-Column-Wide-Left'), @('Page Header', 'page-header', 'Page-Header'))
foreach ($t in $tpl) { Put (Join-Path $Repo "web-templates\$($t[0]).html") (Join-Path $Site "web-templates\$($t[1])\$($t[2]).webtemplate.source.html") }
# pages: repo folder -> slug / base name
$pages = @(
  @('Home', 'home', 'Home'), @('Dashboard', 'dashboard', 'Dashboard'), @('Incident Response', 'incident-response', 'Incident-Response'),
  @('Reports  Analytics', 'reports-&-analytics', 'Reports-&-Analytics'), @('About Us', 'about-us', 'About-Us'), @('Contact Us', 'contact-us', 'Contact-Us'),
  @('FAQ', 'faq', 'FAQ'), @('Profile', 'profile', 'Profile'), @('Access Denied', 'access-denied', 'Access-Denied'), @('Page Not Found', 'page-not-found', 'Page-Not-Found'))
foreach ($p in $pages) {
  $src = Join-Path $Repo "web-pages\$($p[0])\$($p[0]).en-US"
  $base = Join-Path $Site "web-pages\$($p[1])"
  foreach ($kind in @(@('.webpage.copy.html', '.webpage.copy.html'), @('.customjs.js', '.webpage.custom_javascript.js'))) {
    Put ($src + $kind[0]) (Join-Path $base ($p[2] + $kind[1]))
    Put ($src + $kind[0]) (Join-Path $base ('content-pages\' + $p[2] + '.en-US' + $kind[1]))
  }
}
Write-Host "Copied $n files into $Site" -ForegroundColor Green
Write-Host 'Next: pac pages upload --path "<Site>" --modelVersion 2'
