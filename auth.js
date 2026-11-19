// Login na conta Microsoft pessoal (outlook.com) com OAuth 2.0 + PKCE.
// Nenhum servidor: os tokens ficam só neste aparelho.
(function () {
  const AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
  const SCOPES = 'openid profile offline_access Mail.Read';
  const KEY = 'cs-auth';

  const cfg = () => window.CS_CONFIG;
  const redirectUri = () => cfg().REDIRECT_URI || (location.origin + location.pathname.replace(/index\.html$/, ''));

  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const sha256 = (s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const save = (t) => localStorage.setItem(KEY, JSON.stringify(t));

  async function login() {
    const verifier = random(48);
    const state = random(16);
    sessionStorage.setItem('cs-pkce', JSON.stringify({ verifier, state }));
    const challenge = b64url(await sha256(verifier));
    const p = new URLSearchParams({
      client_id: cfg().CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri(),
      response_mode: 'query',
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      prompt: 'select_account',
    });
    location.assign(`${AUTH}/authorize?${p}`);
  }

  async function tokenRequest(body) {
    const r = await fetch(`${AUTH}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg().CLIENT_ID, scope: SCOPES, ...body }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.error || 'Falha no login');
    const t = {
      access_token: j.access_token,
      refresh_token: j.refresh_token || (load() || {}).refresh_token,
      expires_at: Date.now() + (j.expires_in - 120) * 1000,
    };
    save(t);
    return t;
  }

  // Chamado ao abrir o app: conclui o login se voltou da Microsoft com ?code=
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (q.get('error')) {
      history.replaceState(null, '', redirectUri());
      throw new Error(q.get('error_description') || q.get('error'));
    }
    const code = q.get('code');
    if (!code) return false;
    const pk = JSON.parse(sessionStorage.getItem('cs-pkce') || '{}');
    sessionStorage.removeItem('cs-pkce');
    history.replaceState(null, '', redirectUri());
    if (!pk.verifier || pk.state !== q.get('state')) throw new Error('Login interrompido. Tente entrar de novo.');
    await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: pk.verifier });
    return true;
  }

  async function getToken() {
    const t = load();
    if (t && t.access_token && Date.now() < t.expires_at) return t.access_token;
    if (t && t.refresh_token) {
      try { return (await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })).access_token; }
      catch (e) { /* sessão expirou */ }
    }
    return null;
  }

  function logout() { localStorage.removeItem(KEY); localStorage.removeItem('cs-cache'); }

  window.CSAuth = { login, logout, handleRedirect, getToken, hasSession: () => !!load(), redirectUri };
})();
