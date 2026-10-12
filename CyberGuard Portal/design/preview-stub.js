// Fake Power Pages: window.shell token + /_api/ responses. MODE set by window.__MODE ('live' | 'forbidden')
(function () {
  var mode = window.__MODE || 'live';
  window.__calls = [];
  window.shell = { getTokenDeferred: function () { return { done: function (cb) { setTimeout(function () { cb('tok'); }, 5); return { fail: function () {} }; } }; } };
  var now = Date.now();
  var rows = [
    { cg_incidentid: 'a1', cg_reference: 'INC-2026-0001', cg_title: 'Live critical one', cg_severity: 'Critical', cg_status: 'New', cg_host: 'HOST-1', cg_assignedto: null, cg_indicators: '1.2.3.4\nevil.example', cg_timeline: '10:00 | Alert fired\n10:05 | Analyst looked', createdon: new Date(now - 3600e3).toISOString(), modifiedon: new Date(now - 3600e3).toISOString() },
    { cg_incidentid: 'a2', cg_reference: 'INC-2026-0002', cg_title: 'Live medium', cg_severity: 'medium', cg_status: 'investigating', cg_host: 'HOST-2', cg_assignedto: 'Izzat Nur Hakim Mohd Asri', createdon: new Date(now - 7200e3).toISOString(), modifiedon: new Date(now - 7200e3).toISOString() },
    { cg_incidentid: 'a3', cg_reference: 'INC-2026-0003', cg_title: 'Live resolved', cg_severity: 'low', cg_status: 'resolved', cg_host: 'HOST-3', cg_assignedto: 'Someone', createdon: new Date(now - 86400e3).toISOString(), cg_resolvedon: new Date(now - 86400e3 + 1800e3).toISOString(), modifiedon: new Date(now - 80000e3).toISOString() }
  ];
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opt) {
    url = String(url); opt = opt || {};
    if (url.indexOf('/_api/') !== 0) return realFetch(url, opt);
    window.__calls.push({ url: url, method: opt.method, body: opt.body, token: opt.headers && opt.headers.__RequestVerificationToken });
    function resp(status, body, headers) { return Promise.resolve(new Response(body == null ? null : JSON.stringify(body), { status: status, headers: headers || {} })); }
    if (mode === 'forbidden') return resp(403, { error: { code: '90040101', message: 'You don\'t have permission' } });
    if (mode === 'error') return resp(500, { error: { message: 'Server error' } });
    var m = opt.method || 'GET';
    if (m === 'GET' && /cg_incidents\?/.test(url)) return resp(200, { value: rows });
    if (m === 'GET' && /cg_incidents\(([^)]+)\)/.test(url)) { var id = /cg_incidents\(([^)]+)\)/.exec(url)[1]; return resp(200, { cg_incidentid: id, cg_reference: 'INC-2026-0099', cg_title: 'New', cg_severity: 'high', cg_status: 'new', createdon: new Date().toISOString() }); }
    if (m === 'POST' && /cg_incidents$/.test(url)) return resp(204, null, { entityid: 'new-id-1' });
    if (m === 'PATCH') return resp(204, null);
    if (m === 'POST' && /cg_contactmessages$/.test(url)) return resp(204, null, { entityid: 'm1' });
    if (m === 'GET' && /cg_handovers\?/.test(url)) return resp(200, { value: [{ cg_handoverid: 'h1', cg_title: 'Night shift', cg_summary: 'Live handover', cg_openitems: 'INC-2026-0001', cg_watch: '', cg_author: 'Live Person', cg_handedto: 'Day', createdon: new Date(now - 3600e3).toISOString() }] });
    if (m === 'GET' && /cg_indicators\?/.test(url)) return resp(200, { value: [{ cg_indicatorid: 'i1', cg_value: '1.2.3.4', cg_type: 'IP address', cg_action: 'Block', cg_reason: 'r', cg_expireson: null, cg_addedby: 'X', cg_incidentref: null, createdon: new Date(now - 3600e3).toISOString() }] });
    if (m === 'POST' && /cg_(handovers|indicators)$/.test(url)) return resp(204, null, { entityid: 'n' + Math.random() });
    if (m === 'DELETE') return resp(204, null);
    if (/cg_articles/.test(url)) return resp(200, { value: [{ cg_articleid: 'x1', cg_title: 'Dataverse article question?', cg_answer: 'Line one\nLine two', cg_category: 'General', cg_sortorder: 1 }] });
    return resp(404, { error: { message: 'nope' } });
  };
})();
