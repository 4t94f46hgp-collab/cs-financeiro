// Leitura do Outlook pelo Microsoft Graph (somente leitura: permissão Mail.Read).
(function () {
  const G = 'https://graph.microsoft.com/v1.0';

  async function get(url, extraHeaders) {
    const token = await CSAuth.getToken();
    if (!token) { const e = new Error('Sessão expirada'); e.code = 'auth'; throw e; }
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...(extraHeaders || {}) } });
    if (r.status === 401) { const e = new Error('Sessão expirada'); e.code = 'auth'; throw e; }
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || `Erro ${r.status} no Outlook`);
    return j;
  }

  // Todas as mensagens de um remetente desde uma data (até maxPages × 100).
  async function bySender(sender, since, maxPages = 5) {
    const filter = `receivedDateTime ge ${since}T00:00:00Z and from/emailAddress/address eq '${sender}'`;
    const p = new URLSearchParams({
      $filter: filter,
      $orderby: 'receivedDateTime desc',
      $select: 'id,subject,bodyPreview,receivedDateTime,webLink,hasAttachments',
      $top: '100',
    });
    let url = `${G}/me/messages?${p}`;
    const out = [];
    let pages = 0;
    while (url && pages < maxPages) {
      const j = await get(url);
      out.push(...(j.value || []));
      url = j['@odata.nextLink'];
      pages++;
    }
    return { messages: out, truncated: !!url };
  }

  // Corpo da mensagem em texto puro
  async function bodyText(id) {
    const j = await get(`${G}/me/messages/${encodeURIComponent(id)}?$select=body`, { Prefer: 'outlook.body-content-type="text"' });
    return (j.body && j.body.content) || '';
  }

  async function me() { return get(`${G}/me?$select=displayName,userPrincipalName`); }

  window.CSGraph = { bySender, bodyText, me };
})();
