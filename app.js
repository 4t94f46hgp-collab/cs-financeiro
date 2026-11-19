(function () {
  const C = window.CS_CONFIG;
  const $ = (id) => document.getElementById(id);
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const money = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : brl.format(Number(v)));
  const date = (s) => { if (!s) return '—'; const [y, m, d] = String(s).split('-'); return `${d}/${m}/${y}`; };
  const mes = (s) => { if (!s) return '—'; const [y, m] = s.split('-'); return `${MESES[+m - 1]}/${y}`; };
  const mesLongo = (s) => { const [y, m] = s.split('-'); return `${MESES_L[+m - 1]} de ${y}`; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const safeLink = (u) => (typeof u === 'string' && /^https:\/\/outlook\.(live|office)\.com\//.test(u) ? u : null);

  const CACHE = 'cs-cache';
  let state = null;          // dados carregados
  let mesSel = null;
  let loading = false;

  // ---------- telas ----------
  function show(view) {
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    const app = ['inicio', 'contas', 'extrato', 'contabil'].includes(view);
    $('tabs').hidden = !app;
    $('btn-refresh').hidden = !app;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === view));
    if (app) { localStorage.setItem('cs-tab', view); window.scrollTo(0, 0); }
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));

  function setStatus(text, isError) {
    const s = $('status');
    s.textContent = text || '';
    s.classList.toggle('error', !!isError);
  }

  // ---------- dados ----------
  async function carregar() {
    if (loading) return;
    loading = true;
    $('btn-refresh').classList.add('spin');
    setStatus('Buscando e-mails…');
    try {
      const [banco, contabil, rel] = await Promise.all([
        CSGraph.bySender(C.REMETENTE_BANCO, C.DESDE),
        CSGraph.bySender(C.REMETENTE_CONTABIL, C.DESDE),
        CSGraph.bySender(C.REMETENTE_RELATORIO, C.DESDE, 2),
      ]);
      // Relatórios mensais: só abre o corpo dos que ainda não estão guardados
      const antigos = new Map(((state && state.relatorios) || []).map((r) => [r.competencia, r]));
      const relatorios = [];
      for (const m of rel.messages) {
        const c = /^Relat[oó]rio Movo (\d{2})\/(\d{4})/i.exec(m.subject || '');
        if (!c) continue;
        const comp = `${c[2]}-${c[1]}`;
        if (relatorios.some((r) => r.competencia === comp)) continue;
        if (antigos.has(comp) && antigos.get(comp).faturamento != null) { relatorios.push(antigos.get(comp)); continue; }
        const texto = await CSGraph.bodyText(m.id);
        relatorios.push(CSParse.parseRelatorio(comp, texto, m.webLink));
      }
      state = {
        at: new Date().toISOString(),
        banco: CSParse.parseBanco(banco.messages),
        docs: CSParse.parseContabil(contabil.messages),
        relatorios: relatorios.sort((a, b) => (a.competencia < b.competencia ? 1 : -1)),
        truncated: banco.truncated || contabil.truncated,
      };
      localStorage.setItem(CACHE, JSON.stringify(state));
      render();
      setStatus(atualizadoEm());
    } catch (e) {
      if (e.code === 'auth') { CSAuth.logout(); state = null; show('login'); setStatus(''); }
      else setStatus(`Não foi possível atualizar: ${e.message}. ${state ? 'Mostrando os últimos dados salvos.' : ''}`, true);
    } finally {
      loading = false;
      $('btn-refresh').classList.remove('spin');
    }
  }
  const atualizadoEm = () => {
    if (!state) return '';
    const d = new Date(state.at);
    return `Atualizado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` + (state.truncated ? ' · histórico parcial' : '');
  };

  // ---------- render ----------
  function render() {
    if (!state) return;
    const fluxo = CSParse.fluxoMensal(state.banco);
    const obr = CSParse.obrigacoes(state.docs, state.banco);

    // seletor de mês
    const sel = $('sel-mes');
    const meses = fluxo.map((f) => f.mes).reverse();
    if (!mesSel || !meses.includes(mesSel)) mesSel = meses[0] || null;
    sel.replaceChildren(...meses.map((m) => { const o = new Option(mes(m), m); o.selected = m === mesSel; return o; }));
    sel.hidden = meses.length < 2;

    const f = fluxo.find((x) => x.mes === mesSel);
    $('k-ent').textContent = money(f && f.entradas);
    $('k-sai').textContent = money(f && f.saidas);
    $('k-imp').textContent = money(f && f.impostos);
    $('k-soc').textContent = money(f && f.socio);

    const abertas = obr.filter((o) => o.situacao !== 'Pago');
    const vencidas = abertas.filter((o) => o.situacao === 'Vencido');
    $('lede').textContent = f
      ? `Em ${mesLongo(f.mes)}, a conta Cora recebeu ${money(f.entradas)} e pagou ${money(f.saidas)}. ` +
        (vencidas.length ? `${vencidas.length} obrigação(ões) vencida(s) sem pagamento.` : abertas.length ? `${abertas.length} obrigação(ões) em aberto.` : 'Nenhuma obrigação em aberto.')
      : 'Nenhum aviso do banco encontrado ainda.';

    // próximas obrigações (abertas, ou as mais recentes se tudo pago)
    const prox = $('proximas');
    prox.replaceChildren();
    const lista = abertas.length ? abertas : obr.slice(0, 3);
    if (!lista.length) prox.append(el('p', 'muted', 'Nenhuma guia ou boleto encontrado.'));
    lista.forEach((o) => prox.append(itemObrigacao(o)));

    renderChart(fluxo);

    // obrigações
    const ob = $('obrigacoes');
    ob.replaceChildren();
    if (!obr.length) ob.append(el('p', 'muted', 'Nenhuma guia ou boleto encontrado.'));
    obr.forEach((o) => ob.append(itemObrigacao(o)));

    renderExtrato();

    // resultado contábil
    const res = $('resultado');
    res.replaceChildren();
    if (!state.relatorios.length) res.append(el('p', 'muted', 'Nenhum relatório mensal da contabilidade encontrado.'));
    for (const r of state.relatorios) {
      const card = el('div', 'card res');
      const h = el('div', 'row-between');
      h.append(el('h3', 'h3', mes(r.competencia)));
      if (r.faturamento) h.append(el('span', 'tag', `impostos ${pct.format(r.impostos / r.faturamento)}`));
      card.append(h);
      const linhas = [
        ['Faturamento', r.faturamento], ['Simples Nacional', r.simples], ['INSS do pró-labore', r.inss_prolabore],
        ['Contabilidade', r.honorarios], ['Sobrou', r.sobrou, 'strong'], ['Pró-labore líquido', r.prolabore_liquido],
        ['Dividendos distribuídos', r.dividendos], ['A receber no fim do mês', r.a_receber],
      ];
      for (const [l, v, cls] of linhas) {
        if (v == null) continue;
        const row = el('div', 'kv' + (cls ? ' ' + cls : ''));
        row.append(el('span', null, l), el('span', 'num', money(v)));
        card.append(row);
      }
      if (r.dividendos != null) card.append(el('p', 'note', `Dividendos: ${pct.format(r.dividendos / 50000)} do limite mensal isento de R$ 50.000 (Lei 15.270/2025).`));
      res.append(card);
    }

    // documentos
    const docs = $('documentos');
    docs.replaceChildren();
    if (!state.docs.length) docs.append(el('p', 'muted', 'Nenhum documento encontrado.'));
    for (const d of state.docs) {
      const it = el('div', 'item');
      const a = el('div', 'item-main');
      a.append(el('p', 'item-t', d.documento), el('p', 'item-s', [d.competencia ? 'Competência ' + mes(d.competencia) : null, 'Recebido ' + date(d.recebido), d.vencimento ? 'Vence ' + date(d.vencimento) : null].filter(Boolean).join(' · ')));
      it.append(a);
      const side = el('div', 'item-side');
      if (d.valor != null) side.append(el('p', 'num', money(d.valor)));
      const u = safeLink(d.link);
      if (u) { const l = el('a', 'link', 'Abrir'); l.href = u; l.target = '_blank'; l.rel = 'noopener'; side.append(l); }
      it.append(side);
      docs.append(it);
    }
  }

  function itemObrigacao(o) {
    const it = el('div', 'item');
    const a = el('div', 'item-main');
    a.append(el('p', 'item-t', o.obrigacao));
    a.append(el('p', 'item-s', [o.competencia ? 'Competência ' + mes(o.competencia) : null, o.vencimento ? 'Vence ' + date(o.vencimento) : null, o.pago_em ? 'Pago em ' + date(o.pago_em) : null].filter(Boolean).join(' · ')));
    it.append(a);
    const side = el('div', 'item-side');
    side.append(el('p', 'num', money(o.valor)));
    const k = o.situacao === 'Pago' ? 'ok' : o.situacao === 'Vencido' ? 'bad' : 'warn';
    side.append(el('span', 'pill pill-' + k, o.situacao));
    it.append(side);
    return it;
  }

  function renderExtrato() {
    const box = $('extrato');
    box.replaceChildren();
    const filtro = $('sel-filtro').value;
    const rows = state.banco.filter((r) => !filtro || r.tipo === filtro);
    if (!rows.length) { box.append(el('p', 'muted', 'Nada encontrado.')); return; }
    let mesAtual = null;
    for (const r of rows) {
      if (r.mes !== mesAtual) { mesAtual = r.mes; const t = mesLongo(r.mes); box.append(el('p', 'group', t[0].toUpperCase() + t.slice(1))); }
      const it = el('div', 'item');
      const a = el('div', 'item-main');
      a.append(el('p', 'item-t', r.contraparte || '—'));
      a.append(el('p', 'item-s', `${date(r.data)} · ${r.tipo === 'Boleto a vencer' ? 'Boleto vence ' + date(r.vencimento) : r.categoria}`));
      it.append(a);
      const side = el('div', 'item-side');
      const v = el('p', 'num ' + (r.tipo === 'Entrada' ? 'pos' : ''), (r.tipo === 'Entrada' ? '+ ' : r.tipo === 'Saída' ? '− ' : '') + money(r.valor));
      side.append(v);
      const u = safeLink(r.link);
      if (u) { const l = el('a', 'link', 'Abrir'); l.href = u; l.target = '_blank'; l.rel = 'noopener'; side.append(l); }
      it.append(side);
      box.append(it);
    }
  }

  function renderChart(fluxo) {
    const box = $('chart');
    box.replaceChildren();
    if (!fluxo.length) { box.append(el('p', 'muted', 'Sem movimentos.')); return; }
    const data = fluxo.slice(-6);
    const W = Math.max(280, box.clientWidth || 340), H = 200, mt = 22, mb = 26;
    const max = Math.max(...data.map((d) => Math.max(d.entradas, d.saidas)), 1) * 1.15;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Entradas e saídas por mês: ' + data.map((d) => `${mes(d.mes)} entradas ${money(d.entradas)}, saídas ${money(d.saidas)}`).join('; '));
    const band = W / data.length, bw = Math.min(46, band * 0.34);
    const y = (v) => H - mb - (v / max) * (H - mt - mb);
    const add = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; svg.append(n); return n; };
    add('line', { x1: 0, x2: W, y1: H - mb, y2: H - mb, class: 'axis' });
    const curto = (v) => (v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(v).toString());
    data.forEach((d, i) => {
      const cx = band * i + band / 2;
      [['entradas', cx - bw - 2, 'bar-in'], ['saidas', cx + 2, 'bar-out']].forEach(([k, x, cls]) => {
        add('rect', { x, y: y(d[k]), width: bw, height: Math.max(0, H - mb - y(d[k])), rx: 3, class: cls });
        add('text', { x: x + bw / 2, y: y(d[k]) - 5, class: 'bar-l', 'text-anchor': 'middle' }, curto(d[k]));
      });
      add('text', { x: cx, y: H - 8, class: 'tick', 'text-anchor': 'middle' }, mes(d.mes));
    });
    box.append(svg);
  }

  $('sel-mes').addEventListener('change', (e) => { mesSel = e.target.value; render(); });
  $('sel-filtro').addEventListener('change', () => state && renderExtrato());
  $('btn-refresh').addEventListener('click', carregar);
  $('btn-login').addEventListener('click', () => CSAuth.login());
  $('btn-logout').addEventListener('click', () => { CSAuth.logout(); state = null; show('login'); setStatus(''); });
  let lastW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - lastW) > 40 && state) { lastW = innerWidth; renderChart(CSParse.fluxoMensal(state.banco)); } });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state && Date.now() - new Date(state.at).getTime() > 30 * 60 * 1000) carregar();
  });

  // ---------- início ----------
  async function start() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (!C.CLIENT_ID || /COLE_AQUI/.test(C.CLIENT_ID)) {
      $('setup-redirect').textContent = CSAuth.redirectUri();
      show('setup');
      return;
    }
    try { await CSAuth.handleRedirect(); }
    catch (e) { show('login'); const le = $('login-error'); le.textContent = e.message; le.hidden = false; return; }
    if (!CSAuth.hasSession()) { show('login'); return; }
    try { state = JSON.parse(localStorage.getItem(CACHE)); } catch (e) { state = null; }
    show(localStorage.getItem('cs-tab') || 'inicio');
    if (state) { render(); setStatus(atualizadoEm()); }
    carregar();
  }
  start();
})();
