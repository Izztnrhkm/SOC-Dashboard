"""Build theme.css and render every page to /home/claude/w/preview for checking with Playwright."""
import os, re, shutil, sys, json
from liquid import Environment
W = '/home/claude/w'; SRC = W + '/src'; PRE = W + '/preview'; SITE = W + '/cyberguard-portal'
FONT = open('/tmp/claude-0/font/ff.css').read()
os.makedirs(W + '/dist', exist_ok=True)
css = FONT + open(SRC + '/theme.src.css').read()
open(W + '/dist/theme.css', 'w').write(css)

PAGES = [  # route, copy, js, title
    ('', 'Home', 'Home'), ('dashboard', 'Dashboard', 'Dashboard'), ('incident-response', 'Response', 'Response'),
    ('reports', 'Reports', 'Reports'), ('handover', 'Handover', 'Handover'), ('watchlist', 'Watchlist', 'Watchlist'), ('playbooks', 'Playbooks', 'Playbooks'), ('escalation', 'Escalation', 'Escalation'), ('faq', 'FAQ', 'FAQ'), ('contact-us', 'Contact', 'Contact'),
    ('about-us', 'About', None), ('profile', 'Profile', 'Profile'), ('access-denied', 'AccessDenied', None), ('page-not-found', 'NotFound', None)]
env = Environment()
def pre(t):
    t = re.sub(r"\{%\s*editable snippets 'Footer'[^%]*%\}", "<p>&copy; 2026 Landasan Digital. All rights reserved.</p>", t)
    t = re.sub(r"\{%\s*editable page 'adx_title'[^%]*%\}", "Search", t)
    t = re.sub(r"\{%\s*searchindex[^%]*%\}", "", t); t = re.sub(r"\{%\s*endsearchindex\s*%\}", "", t)
    t = re.sub(r"\{%\s*include 'Pagination'[^%]*%\}", "<ul class='pagination'><li class='active'><span>1</span></li><li><a href='#'>2</a></li></ul>", t)
    return t
def ctx(signed=True, roles=('SOC Analyst', 'Authenticated Users'), q='', name='Izzat Nur Hakim Mohd Asri'):
    u = {'fullname': name, 'emailaddress1': 'izzat@landasandigital.com', 'telephone1': '', 'roles': list(roles)} if signed else None
    return {'user': u, 'website': {'adx_partialurl': '', 'sign_out_url_substitution': '/Account/Login/LogOff', 'sign_in_url_substitution': '/SignIn'},
            'sitemarkers': {'Search': {'url': '/search/'}}, 'snippets': {}, 'request': {'params': {'q': q}, 'path': '/search/'},
            'searchindex': {'approximate_total_hits': 2, 'page': 1, 'results': [
                {'title': 'Incident response', 'url': '/incident-response/', 'fragment': 'Isolate the host... <em>ransomware</em> or attacker moving between systems.'},
                {'title': 'Questions and answers', 'url': '/faq/', 'fragment': 'A device shows a <em>ransom</em> message. What do I do first?'}]}}
def render(path, c): return env.from_string(pre(open(path).read())).render(**c)

PROFILE_FORM = """<div class="container"><div class="row"><div class="col-md-4"><div class="panel panel-default"><div class="panel-body"><h4>Izzat Nur Hakim Mohd Asri</h4></div></div>
<div class="list-group"><a class="list-group-item active" href="#">Profile</a></div><div class="panel panel-default"><div class="panel-heading"><h4 class="panel-title">Security</h4></div><div class="list-group"><a class="list-group-item" href="#">Set password</a><a class="list-group-item" href="#">Change email</a><a class="list-group-item" href="#">Manage external authentication</a></div></div></div>
<div class="col-md-8">%COPY%<div class="entity-form crmEntityFormView"><fieldset><legend>Your information</legend><div class="row"><div class="col-md-6 form-group"><label class="control-label">First Name</label><input class="form-control" value="Izzat Nur Hakim"></div><div class="col-md-6 form-group"><label class="control-label">Last Name</label><input class="form-control" value="Mohd Asri"></div></div></fieldset><input type="submit" class="btn btn-primary" value="Update"></div></div></div></div>"""

def page(route, copy, js, c, out=None, wrapper=True):
    hdr = render(SRC + '/Header.html', c); ftr = render(SRC + '/Footer.html', c)
    body = render(SRC + '/pages/' + copy + '.copy.html', c) if copy.endswith('.html') is False and os.path.exists(SRC + '/pages/' + copy + '.copy.html') else render(SRC + '/' + copy, c)
    if route == 'profile': body = PROFILE_FORM.replace('%COPY%', body)
    script = '<script>' + open(SRC + '/pages/' + js + '.js').read() + '</script>' if js else ''
    html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + copy + ' - Landasan Digital SOC Portal</title>'
            '<link rel="stylesheet" href="/bootstrap.min.css"><link rel="stylesheet" href="/portalbasictheme.css"><link rel="stylesheet" href="/theme.css"></head><body>'
            + hdr + '<div id="mainContent" class="wrapper-body" role="main">' + body + '</div>' + ftr + script + '</body></html>')
    d = os.path.join(PRE, out or route); os.makedirs(d, exist_ok=True); open(os.path.join(d, 'index.html'), 'w').write(html)

shutil.rmtree(PRE, ignore_errors=True); os.makedirs(PRE)
for f in ['bootstrap.min.css', 'portalbasictheme.css', 'ldsb-icon.png']: shutil.copy(SITE + '/web-files/' + f, PRE + '/' + f)
shutil.copy(W + '/dist/theme.css', PRE + '/theme.css')
for route, copy, js in PAGES:
    page(route, copy, js, ctx())
page('search', 'SearchResults.html', None, ctx(q='ransomware'))
page('profile', 'Profile', 'Profile', ctx(roles=('Authenticated Users',)), out='profile-noaccess')
page('', 'Home', 'Home', ctx(signed=False), out='signed-out')
page('dashboard', 'Dashboard', 'Dashboard', ctx(name="Aisyah O'Neil"), out='apos')

# Mocks of the Power Pages built-in account pages (Bootstrap 3 markup as Power Pages renders it)
TABS = lambda a: ('<ul class="nav nav-tabs nav-account" role="navigation">'
  + ''.join('<li%s><a href="%s"><span class="fa fa-%s" aria-hidden="true"></span> %s</a></li>' % (' class="active"' if i == a else '', u, ic, t)
            for i, (u, ic, t) in enumerate([('/SignIn', 'sign-in', 'Sign in'), ('/Account/Login/Register', 'pencil-square-o', 'Register'), ('/Register', 'ticket', 'Redeem invitation')])) + '</ul>')
HEAD = lambda t: '<div class="page-heading"><ul class="breadcrumb"><li><a href="/">Home</a></li><li class="active">%s</li></ul><div class="page-header"><h1>%s</h1></div></div>' % (t, t)
FG = lambda lab, id, typ='text': '<div class="form-group"><label class="col-sm-4 control-label required" for="%s">%s</label><div class="col-sm-8"><input class="form-control" id="%s" name="%s" type="%s"></div></div>' % (id, lab, id, id, typ)
EXT = lambda leg: ('<div class="col-md-6"><form action="/Account/Login/ExternalLogin" method="post"><div class="form-horizontal"><fieldset><legend>%s</legend>'
  '<ul class="list-unstyled"><li><button name="provider" type="submit" class="btn btn-primary btn-line" id="https://login.windows.net/abc/" title="Azure AD" value="https://login.windows.net/abc/">Azure AD</button></li></ul></fieldset></div></form></div>') % leg
CAP = '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="50"><rect width="250" height="50" fill="#eee"/><text x="40" y="34" font-size="26" font-family="monospace" fill="#555">X7KQ2M</text></svg>'
import base64
CAPIMG = 'data:image/svg+xml;base64,' + base64.b64encode(CAP.encode()).decode()
AUTH = {
 'SignIn': HEAD('Sign in') + TABS(0) + '<div class="row"><div class="col-md-6"><form action="/SignIn" method="post"><div class="form-horizontal"><fieldset><legend>Sign in with a local account</legend>'
   + FG('Username', 'Username') + FG('Password', 'PasswordValue', 'password')
   + '<div class="form-group"><div class="col-sm-offset-4 col-sm-8"><div class="checkbox"><label><input type="checkbox" id="RememberMe"> Remember me?</label></div></div></div>'
   + '<div class="form-group"><div class="col-sm-offset-4 col-sm-8"><button id="submit-signin-local" class="btn btn-primary">Sign in</button> <a class="btn btn-default" href="/Account/Login/ForgotPassword">Forgot Your Password?</a></div></div>'
   + '</fieldset></div></form></div>' + EXT('Sign in with an external account') + '</div>',
 'Account/Login/Register': HEAD('Register') + TABS(1) + '<div class="row"><div class="col-md-6"><form action="/Account/Login/Register" method="post"><div class="form-horizontal"><fieldset><legend>Register for a new local account</legend>'
   + '<div class="alert alert-block alert-danger validation-summary-errors"><ul><li>The captcha code is not valid.</li></ul></div>'
   + FG('Email', 'EmailTextBox', 'email') + FG('Username', 'UserNameTextBox') + FG('Password', 'PasswordTextBox', 'password') + FG('Confirm password', 'ConfirmPasswordTextBox', 'password')
   + '<div class="form-group"><div class="col-sm-offset-4 col-sm-8"><div id="RegisterCaptcha" class="captcha"><img id="RegisterCaptcha_CaptchaImage" src="' + CAPIMG + '" alt="Captcha"><div><a href="#">Generate a new image</a><a href="#">Play the audio code</a></div></div></div></div>'
   + FG('Enter the code from the image', 'CaptchaTextBox')
   + '<div class="form-group"><div class="col-sm-offset-4 col-sm-8"><button id="SubmitButton" class="btn btn-primary">Register</button></div></div>'
   + '</fieldset></div></form></div>' + EXT('Register using an external account') + '</div>',
 'Register': HEAD('Redeem invitation') + TABS(2) + '<form action="/Register" method="post" class="form-horizontal"><fieldset><legend>Sign up with an invitation code</legend>'
   + '<div class="form-group"><label class="col-sm-2 control-label required" for="InvitationCode">Invitation code</label><div class="col-sm-10"><input class="form-control" id="InvitationCode" type="text"></div></div>'
   + '<div class="form-group"><div class="col-sm-offset-2 col-sm-10"><div class="checkbox"><label><input type="checkbox" id="RedeemByLogin"> I have an existing account</label></div></div></div>'
   + '<div class="form-group"><div class="col-sm-offset-2 col-sm-10"><button id="submit-redeem-invitation" class="btn btn-primary">Register</button></div></div></fieldset></form>',
}
for route, body in AUTH.items():
    c = ctx(signed=False)
    hdr = render(SRC + '/Header.html', c); ftr = render(SRC + '/Footer.html', c)
    html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + route + '</title>'
            '<link rel="stylesheet" href="/bootstrap.min.css"><link rel="stylesheet" href="/portalbasictheme.css"><link rel="stylesheet" href="/theme.css"></head><body>'
            + hdr + '<div id="mainContent" class="wrapper-body" role="main"><div class="container">' + body + '</div></div>' + ftr + '</body></html>')
    d = os.path.join(PRE, route); os.makedirs(d, exist_ok=True); open(os.path.join(d, 'index.html'), 'w').write(html)

# Second mock: Bootstrap 5 style markup, no .container, headings as h2 (closer to newer Power Pages)
NAV5 = lambda a: ('<ul class="nav nav-tabs" role="tablist">' + ''.join('<li class="nav-item"><a class="nav-link%s" href="%s"><span class="fa fa-%s"></span> %s</a></li>' % (' active' if i == a else '', u, ic, t)
       for i, (u, ic, t) in enumerate([('/alt/SignIn', 'sign-in', 'Sign in'), ('/alt/Account/Login/Register', 'pencil', 'Register'), ('/alt/Register', 'ticket', 'Redeem invitation')])) + '</ul>')
EXT5 = lambda h, cap: '<div class="row"><div class="col-12"><form method="post"><h2>%s</h2><hr><button name="provider" type="submit" class="btn btn-primary" value="https://login.windows.net/abc/">%s</button></form></div></div>' % (h, cap)
ALT = {
 'alt/SignIn': NAV5(0) + EXT5('Sign in with an external account', 'Azure AD'),
 'alt/Account/Login/Register': NAV5(1) + EXT5('Register using an external account', 'Azure AD'),
 'alt/Register': NAV5(2) + '<div class="row"><div class="col-12"><form method="post"><h2>Sign up with an invitation code</h2><hr><div class="mb-3"><label class="form-label required" for="InvitationCode">Invitation code</label><input class="form-control" id="InvitationCode"></div><div class="form-check"><input class="form-check-input" type="checkbox" id="RedeemByLogin"><label class="form-check-label" for="RedeemByLogin">I have an existing account</label></div><button type="submit" class="btn btn-primary">Register</button></form></div></div>',
}
for route, body in ALT.items():
    c = ctx(signed=False)
    hdr = render(SRC + '/Header.html', c); ftr = render(SRC + '/Footer.html', c)
    html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + route + '</title>'
            '<link rel="stylesheet" href="/bootstrap.min.css"><link rel="stylesheet" href="/portalbasictheme.css"><link rel="stylesheet" href="/theme.css"></head><body>'
            + hdr + '<div id="mainContent" class="wrapper-body" role="main"><div class="page-content">' + body + '</div></div>' + ftr + '</body></html>')
    d = os.path.join(PRE, route); os.makedirs(d, exist_ok=True); open(os.path.join(d, 'index.html'), 'w').write(html)

# Third mock: tabs drawn outside #mainContent (as on the live site)
for route, body in [('alt2/SignIn', EXT5('Sign in with an external account', 'Azure AD')), ('alt2/Register', ALT['alt/Register'].split('</ul>', 1)[1])]:
    a = 0 if 'SignIn' in route else 2
    c = ctx(signed=False)
    hdr = render(SRC + '/Header.html', c); ftr = render(SRC + '/Footer.html', c)
    strip = '<div class="nav-strip" style="border-bottom:1px solid #e4e4e4;padding:20px 0">' + NAV5(a).replace('/alt/', '/alt2/') + '</div>'
    html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + route + '</title>'
            '<link rel="stylesheet" href="/bootstrap.min.css"><link rel="stylesheet" href="/portalbasictheme.css"><link rel="stylesheet" href="/theme.css"></head><body>'
            + hdr + strip + '<div id="mainContent" class="wrapper-body" role="main"><div class="page-content">' + body + '</div></div>' + ftr + '</body></html>')
    d = os.path.join(PRE, route); os.makedirs(d, exist_ok=True); open(os.path.join(d, 'index.html'), 'w').write(html)
print('built', len(css), 'bytes css')
