/* ==========================================================================
   CyberGuard — Dashboard controller
   Data: sample incidents + incidents logged on this device (localStorage).
   To go live, replace load() with a Power Pages Web API call:
     shell.getTokenDeferred().done(t => fetch('/_api/<table>?$top=200', {headers:{'__RequestVerificationToken':t}}))
   and map each row to the shape used in SEED below.
   ========================================================================== */
(function () {
  'use strict';
  var el = function (id) { return document.getElementById(id); };
  if (!el('rows')) return;
  var esc = (window.CG && CG.esc) || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var toast = (window.CG && CG.toast) || function () {};

  var SEED = [{"id":"INC-2026-8941","title":"Ransomware Pre-Execution: Cobalt Strike Beaconing Detected","sev":"critical","cat":"Ransomware / C2","mitre":"T1071.001 Web Protocols","host":"FIN-DB-SVR01","ip":"10.14.2.105","user":"r.henderson@cyberguard.internal","src":"Defender XDR","status":"investigating","owner":"Jessica Lee (CISO / Lead)","ago":4,"risk":96,"iso":false,"sum":"Suspicious HTTPS traffic beaconing in regular 45s intervals to known adversary C2 IP (185.220.101.44). Cobalt Strike malleable C2 profile identified by EDR behavioral monitor.","iocs":["185.220.101.44 (C2 Remote IP)","hash: 4e8b34f8a846c4f901174092d6e4917b2e3e5c9b687f87a32d1840ab7183e8fa","process: powershell.exe -enc SQBFAFgA..."],"tl":[{"time":"14:18:02 UTC","event":"PowerShell spawned with hidden base64 encoded parameters."},{"time":"14:18:15 UTC","event":"Outbound TLS session established to untrusted IP 185.220.101.44."},{"time":"14:18:40 UTC","event":"Defender XDR triggered Sev-1 alert; memory scan confirmed Cobalt Strike stager."}]},{"id":"INC-2026-8940","title":"Active Kerberoasting & Service Ticket Harvesting Spike","sev":"critical","cat":"Privilege Escalation","mitre":"T1558.003 Kerberoasting","host":"DC-CORP-01","ip":"10.10.0.10","user":"svc_backup_agent","src":"Azure Sentinel","status":"new","owner":"Unassigned","ago":11,"risk":92,"iso":false,"sum":"Excessive Kerberos TGS requests (over 180 requests in 90 seconds) for service accounts with RC4 encryption. Possible offline hash cracking attempt in progress.","iocs":["Event ID: 4769 (Audit Kerberos Service Ticket Operations)","Target SPN: MSSQLSvc/sql-prod.cyberguard.internal:1433","Encryption: 0x17 (RC4-HMAC weak cipher requested)"],"tl":[{"time":"14:11:10 UTC","event":"Spike of Kerberos TGS ticket queries originating from WKS-DEV-08."},{"time":"14:12:00 UTC","event":"Sentinel analytics rule 'Kerberoasting Pattern Detection' fired."}]},{"id":"INC-2026-8939","title":"Potential Data Exfiltration via Encrypted DNS Tunneling","sev":"critical","cat":"Exfiltration","mitre":"T1048.003 DNS Tunneling","host":"RND-WS-204","ip":"10.20.4.52","user":"d.chen@cyberguard.internal","src":"Palo Alto NGFW","status":"investigating","owner":"David Martinez","ago":23,"risk":88,"iso":true,"sum":"High volume of abnormal TXT and null DNS record queries directed to rogue nameserver ns1.darkrelay-sync.cc. Payload inspection indicates compressed document exfiltration.","iocs":["ns1.darkrelay-sync.cc (Rogue NS)","Queries: 14,200 requests / 15 mins","Average Query Length: 182 characters"],"tl":[{"time":"13:58:12 UTC","event":"DNS query volume surged 800% above baseline."},{"time":"14:02:18 UTC","event":"Network firewall flagged tunneling signature; host auto-quarantined."}]},{"id":"INC-2026-8938","title":"Credential Stuffing / Password Spray on Entra ID Admin Portal","sev":"high","cat":"Initial Access","mitre":"T1110.003 Password Spraying","host":"ENTRA-ID-TENANT","ip":"194.26.29.11","user":"Multiple (42 Accounts)","src":"Azure Sentinel","status":"investigating","owner":"David Martinez","ago":34,"risk":79,"iso":false,"sum":"Distributed IP network attempting low-and-slow authentication against cloud accounts using common passwords. 3 accounts triggered Risk State 'High'.","iocs":["194.26.29.11 (TOR Exit Node)","User-Agent: python-requests/2.28","Failed Sign-ins: 384 attempts across 42 identities"],"tl":[{"time":"13:45:00 UTC","event":"Initial wave of login failures detected across multiple departments."},{"time":"13:50:00 UTC","event":"Identity Protection elevated user risk; Conditional Access enforced MFA."}]},{"id":"INC-2026-8937","title":"LSASS Memory Dump via MiniDumpWriteDump API","sev":"high","cat":"Credential Access","mitre":"T1003.001 LSASS Memory","host":"HR-PAYROLL-02","ip":"10.12.1.88","user":"m.adams@cyberguard.internal","src":"CrowdStrike Falcon","status":"contained","owner":"Monica Patel","ago":48,"risk":84,"iso":true,"sum":"Unsigned binary attempted to read credentials from Local Security Authority Subsystem Service (LSASS) process memory. Blocked in pre-execution by kernel driver.","iocs":["File: C:\\Users\\Public\\dbgmon.exe","Hash: b1946ac92492d2347c6235b4d2611184","Target Process: lsass.exe (PID 628)"],"tl":[{"time":"13:30:14 UTC","event":"Host accessed malicious phishing macro attachment."},{"time":"13:31:02 UTC","event":"dbgmon.exe dropped into Public folder and executed."},{"time":"13:31:04 UTC","event":"Falcon blocked memory access; host network isolated."}]},{"id":"INC-2026-8936","title":"Scheduled Task Persistence Created in System32","sev":"high","cat":"Persistence","mitre":"T1053.005 Scheduled Task","host":"APP-SVR-PROD04","ip":"10.14.3.40","user":"SYSTEM","src":"Defender XDR","status":"investigating","owner":"Jessica Lee (CISO / Lead)","ago":70,"risk":76,"iso":false,"sum":"Hidden scheduled task registered with SYSTEM privileges configured to run a PowerShell reverse shell every 60 minutes upon reboot.","iocs":["Task Name: \\Microsoft\\Windows\\Maintenance\\WinUpdaterService","Action: wscript.exe C:\\ProgramData\\svchost.vbs"],"tl":[{"time":"13:08:00 UTC","event":"Schtasks command invoked from cmd.exe under admin context."}]},{"id":"INC-2026-8935","title":"Phishing BEC: Suspicious Mail Forwarding Rule Created","sev":"medium","cat":"Initial Access","mitre":"T1114.003 Email Forwarding Rule","host":"EXCHANGE-ONLINE","ip":"82.102.23.4","user":"cfo-exec@cyberguard.internal","src":"Defender XDR","status":"investigating","owner":"Monica Patel","ago":95,"risk":68,"iso":false,"sum":"Inbox forwarding rule 'AutoArchive' created to forward all messages containing 'Invoice', 'Wire', or 'Payment' to external inbox audit-financials@protonmail.com.","iocs":["Forwarding Address: audit-financials@protonmail.com","Rule Name: AutoArchive","IP of modification: 82.102.23.4 (Romania)"],"tl":[{"time":"12:45:00 UTC","event":"Account accessed from unusual geography without active VPN."},{"time":"12:46:12 UTC","event":"New-InboxRule cmdlet executed; alert fired in Defender for Office 365."}]},{"id":"INC-2026-8934","title":"Unauthorized Port Scan on Internal DMZ Subnet","sev":"medium","cat":"Discovery","mitre":"T1046 Network Service Discovery","host":"DMZ-GW-01","ip":"10.50.0.1","user":"N/A (Network Device)","src":"Palo Alto NGFW","status":"contained","owner":"David Martinez","ago":135,"risk":62,"iso":false,"sum":"SYN scan targeting ports 22, 80, 443, 3389, 445 across 254 internal IP addresses. Source host was a misconfigured contractor laptop.","iocs":["Source: 10.50.1.84 (Contractor-VLAN)","Rate: 4,000 packets/sec"],"tl":[{"time":"12:05:00 UTC","event":"Firewall IPS tripped SYN flood & scan signature; port blocked at switch."}]},{"id":"INC-2026-8933","title":"Outdated OpenSSL Vulnerability Probe (CVE-2023-3817)","sev":"low","cat":"Vulnerability","mitre":"T1190 Exploit Public-Facing App","host":"WEB-PROXY-EXT","ip":"45.154.255.80","user":"Anonymous Web Traffic","src":"Cloudflare WAF","status":"resolved","owner":"SOC Auto-Remediation","ago":220,"risk":35,"iso":false,"sum":"Automated vulnerability scanner probed public SSL handshake for DH parameter flaws. Automatically dropped at Cloudflare Edge.","iocs":["Scanner IP: 45.154.255.80","WAF Rule: 100048 (SSL Attack Signature)"],"tl":[{"time":"10:40:00 UTC","event":"Probe blocked by edge rule; zero internal impact."}]}];
  var RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  var LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', 'new': 'New', investigating: 'Investigating', contained: 'Contained', resolved: 'Resolved' };
  var PAGE = 8;
  var state = { sev: 'all', status: 'open', q: '', page: 1, openId: null };
  var data = [];

  function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }

  function load() {
    var now = Date.now(), over = store('cg_overrides') || {};
    var seed = SEED.map(function (s) { return { id: s.id, title: s.title, sev: s.sev, cat: s.cat, mitre: s.mitre, host: s.host, ip: s.ip, user: s.user, src: s.src, status: s.status, owner: s.owner, created: now - s.ago * 60000, risk: s.risk, iso: s.iso, sum: s.sum, iocs: s.iocs || [], tl: s.tl || [] }; });
    var mine = (window.CG ? CG.userIncidents() : (store('cg_user_incidents') || [])).map(function (u) {
      return { id: u.id, title: u.title, sev: u.sev || 'medium', cat: u.cat || 'Reported', mitre: u.mitre || '', host: u.host || '—', ip: u.ip || '', user: u.user || '', src: u.src || 'Manual report', status: u.status || 'new', owner: 'Unassigned', created: u.created || now, risk: u.risk || '', iso: false, sum: u.sum || 'Logged from the portal.', iocs: [], tl: [{ time: new Date(u.created || now).toLocaleString(), event: 'Incident logged from the portal.' }] };
    });
    data = mine.concat(seed).map(function (i) { var o = over[i.id]; if (o) { i.status = o.status || i.status; i.notes = o.notes || ''; if (typeof o.iso === 'boolean') i.iso = o.iso; } return i; });
  }
  function save(i) { var o = store('cg_overrides') || {}; o[i.id] = { status: i.status, notes: i.notes || '', iso: !!i.iso }; store('cg_overrides', o); }

  function age(ts) { var m = Math.max(1, Math.round((Date.now() - ts) / 60000)); if (m < 60) return m + ' min'; var h = Math.round(m / 60); return h < 48 ? h + ' h' : Math.round(h / 24) + ' d'; }
  function isOpen(i) { return i.status !== 'resolved'; }
  function dot(sev) { return '<span class="cg-badge sev-' + sev + '"><span class="cg-dot"></span>' + LABEL[sev] + '</span>'; }

  function filtered() {
    var q = state.q.toLowerCase();
    return data.filter(function (i) {
      if (state.sev !== 'all' && i.sev !== state.sev) return false;
      if (state.status === 'open' ? !isOpen(i) : (state.status !== 'all' && i.status !== state.status)) return false;
      return !q || [i.id, i.title, i.host, i.user, i.mitre, i.cat, i.ip, i.src].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return RANK[a.sev] - RANK[b.sev] || b.created - a.created; });
  }

  function renderStats() {
    var open = data.filter(isOpen), crit = open.filter(function (i) { return i.sev === 'critical'; }).length;
    el('kOpen').textContent = open.length;
    el('kOpenSub').textContent = 'Open incidents · ' + crit + ' critical';
    // sample 7-day history, today = live count
    var hist = [6, 9, 7, 11, 8, 12, data.length], max = Math.max.apply(null, hist), names = ['', '', '', '', '', '', 'Today'], d = new Date();
    el('barDays').innerHTML = hist.map(function (v, k) { var dd = new Date(d.getTime() - (6 - k) * 86400000); var n = k === 6 ? 'Today' : dd.toLocaleDateString(undefined, { weekday: 'short' }); return '<div><span>' + v + '</span><i style="height:' + Math.max(2, Math.round(v / max * 100)) + '%"></i><span>' + n + '</span></div>'; }).join('');
    var colors = { critical: 'var(--crit)', high: 'var(--high)', medium: 'var(--med)', low: 'var(--low)' }, total = open.length || 1;
    el('splitSev').innerHTML = ['critical', 'high', 'medium', 'low'].map(function (s) { var n = open.filter(function (i) { return i.sev === s; }).length; return n ? '<i style="width:' + (n / total * 100) + '%;background:' + colors[s] + '" title="' + LABEL[s] + ': ' + n + '"></i>' : ''; }).join('');
    el('legendSev').innerHTML = ['critical', 'high', 'medium', 'low'].map(function (s) { return '<span><span class="cg-dot ' + s + '"></span> ' + LABEL[s] + '<b>' + open.filter(function (i) { return i.sev === s; }).length + '</b></span>'; }).join('');
    el('legendStatus').innerHTML = ['new', 'investigating', 'contained'].map(function (s) { return '<span>' + LABEL[s] + '<b>' + open.filter(function (i) { return i.status === s; }).length + '</b></span>'; }).join('');
  }

  function renderTable() {
    var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE));
    state.page = Math.min(state.page, pages);
    var from = (state.page - 1) * PAGE, view = list.slice(from, from + PAGE);
    el('rows').innerHTML = view.length ? view.map(function (i) {
      return '<tr class="click" tabindex="0" data-id="' + esc(i.id) + '"><td>' + dot(i.sev) + '</td>' +
        '<td><strong>' + esc(i.title) + '</strong><div class="sub"><span class="cg-mono">' + esc(i.id) + '</span> · ' + esc(i.cat) + '</div></td>' +
        '<td>' + esc(i.host) + '<div class="sub">' + esc(i.user) + '</div></td><td>' + esc(i.src) + '</td><td>' + age(i.created) + '</td>' +
        '<td><span class="cg-badge">' + LABEL[i.status] + '</span></td></tr>';
    }).join('') : '<tr><td colspan="6" class="cg-empty">No incidents match these filters.</td></tr>';
    el('info').textContent = list.length ? 'Showing ' + (from + 1) + '–' + (from + view.length) + ' of ' + list.length : '';
    el('prev').disabled = state.page <= 1; el('next').disabled = state.page >= pages;
  }
  function render() { renderStats(); renderTable(); }

  // drawer
  function openDrawer(id) {
    var i = data.filter(function (x) { return x.id === id; })[0]; if (!i) return;
    state.openId = id;
    el('dBadges').innerHTML = dot(i.sev) + '<span class="cg-badge cg-mono">' + esc(i.id) + '</span>';
    el('dTitle').textContent = i.title; el('dSum').textContent = i.sum;
    var rows = [['Category', i.cat], ['Technique', i.mitre], ['Host', i.host], ['IP address', i.ip], ['Account', i.user], ['Source', i.src], ['Owner', i.owner], ['Risk score', i.risk ? i.risk + ' / 100' : '']];
    el('dMeta').innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    el('dIoc').innerHTML = i.iocs.length ? i.iocs.map(function (x) { return '<li class="cg-mono" style="margin-bottom:4px;word-break:break-all">' + esc(x) + '</li>'; }).join('') : '<li style="list-style:none;margin-left:-18px;color:var(--muted)">None recorded.</li>';
    el('dTl').innerHTML = i.tl.map(function (t) { return '<li><time>' + esc(t.time) + '</time>' + esc(t.event) + '</li>'; }).join('');
    el('dStatus').value = i.status; el('dNotes').value = i.notes || '';
    el('dIso').textContent = i.iso ? 'Release host isolation' : 'Isolate host';
    el('drawer').classList.add('show'); el('dBg').classList.add('show'); el('drawer').setAttribute('aria-hidden', 'false');
    document.body.classList.add('cg-lock'); el('dClose').focus();
  }
  function closeDrawer() { el('drawer').classList.remove('show'); el('dBg').classList.remove('show'); el('drawer').setAttribute('aria-hidden', 'true'); document.body.classList.remove('cg-lock'); state.openId = null; }
  function current() { return data.filter(function (x) { return x.id === state.openId; })[0]; }

  // csv
  function csv() {
    var head = ['ID', 'Severity', 'Status', 'Title', 'Category', 'Host', 'Account', 'Source', 'Technique', 'Created'];
    var lines = [head].concat(filtered().map(function (i) { return [i.id, i.sev, i.status, i.title, i.cat, i.host, i.user, i.src, i.mitre, new Date(i.created).toISOString()]; }))
      .map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); });
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' })); a.download = 'incidents.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  function bind() {
    var t; el('fQ').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { state.q = e.target.value; state.page = 1; renderTable(); }, 120); });
    el('fStatus').addEventListener('change', function (e) { state.status = e.target.value; state.page = 1; renderTable(); });
    el('chips').addEventListener('click', function (e) { var b = e.target.closest('.cg-chip'); if (!b) return; state.sev = b.dataset.sev; state.page = 1; [].forEach.call(el('chips').children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); }); renderTable(); });
    el('prev').addEventListener('click', function () { state.page--; renderTable(); });
    el('next').addEventListener('click', function () { state.page++; renderTable(); });
    el('rows').addEventListener('click', function (e) { var r = e.target.closest('tr[data-id]'); if (r) openDrawer(r.dataset.id); });
    el('rows').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var r = e.target.closest('tr[data-id]'); if (r) { e.preventDefault(); openDrawer(r.dataset.id); } } });
    el('dClose').addEventListener('click', closeDrawer); el('dBg').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.openId) closeDrawer(); });
    el('dSave').addEventListener('click', function () { var i = current(); if (!i) return; i.status = el('dStatus').value; i.notes = el('dNotes').value; save(i); render(); closeDrawer(); toast('Saved ' + i.id); });
    el('dIso').addEventListener('click', function () { var i = current(); if (!i) return; i.iso = !i.iso; save(i); el('dIso').textContent = i.iso ? 'Release host isolation' : 'Isolate host'; toast(i.iso ? 'Isolation requested for ' + i.host : 'Isolation released for ' + i.host); });
    el('btnCsv').addEventListener('click', csv);
    var dlg = el('newDlg');
    el('btnNew').addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); el('nTitle').focus(); });
    el('nCancel').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    el('newForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!el('nTitle').value.trim()) { el('nTitle').focus(); return; }
      var inc = { title: el('nTitle').value.trim(), sev: el('nSev').value, src: el('nSrc').value, host: el('nHost').value.trim(), sum: el('nDesc').value.trim() || 'Logged from the portal.', status: 'new' };
      if (window.CG) CG.addIncident(inc);
      dlg.close ? dlg.close() : dlg.removeAttribute('open'); e.target.reset(); load(); state.status = 'open'; el('fStatus').value = 'open'; state.page = 1; render(); toast('Incident logged');
    });
  }

  load(); bind(); render();
  setInterval(renderTable, 60000);
})();
