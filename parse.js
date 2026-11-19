// Transforma os e-mails em lançamentos, documentos e relatórios, e faz as contas.
(function (root) {
  const brl = (s) => {
    s = String(s || '').trim().replace(/[.,]$/, '');
    if (/,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s.replace(/,/g, ''));
  };
  const dia = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const dmy = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const r2 = (x) => Math.round(x * 100) / 100;

  function categoria(nome, tipo) {
    const n = (nome || '').toUpperCase();
    if (n.includes('MINISTERIO DA FAZENDA') || n.includes('RECEITA FEDERAL')) return 'Impostos';
    if (n.includes('CARLOS ANTONIO DE SOUZA')) return 'Sócio';
    if (n.includes('MOVO')) return 'Contabilidade';
    if (tipo === 'Entrada') return 'Receita de serviços';
    return 'Outras despesas';
  }

  // Avisos do banco Cora
  function parseBanco(messages) {
    const rows = [];
    for (const e of messages) {
      const subj = e.subject || '';
      const sum = String(e.bodyPreview || '').replace(/\r/g, '');
      const data = dia(e.receivedDateTime);
      let tipo = null, contraparte = null, valor = null, vencimento = null, m;
      if (/transfer[eê]ncia Pix foi realizada/i.test(subj)) {
        tipo = 'Saída';
        m = /^\s*(.+?)\s+-\s+R\$\s*([\d.,]+)/.exec(sum);
        if (m) { contraparte = m[1].trim(); valor = brl(m[2]); }
        else if ((m = /valor de R\$\s*([\d.,]+)\s+para\s+(.+?)\s+foi efetuada/i.exec(sum))) { valor = brl(m[1]); contraparte = m[2].trim(); }
      } else if (/recebeu uma transfer[eê]ncia Pix/i.test(subj)) {
        tipo = 'Entrada';
        m = /valor de R\$\s*([\d.,]+)\s+de\s+(.+?)\.?\s*$/m.exec(sum);
        if (m) { valor = brl(m[1]); contraparte = m[2].trim(); }
      } else if (/pagamento foi confirmado/i.test(subj)) {
        tipo = 'Saída';
        m = /para\s+(.+?)\s+no valor de R\$\s*([\d.,]+)/i.exec(sum);
        if (m) { contraparte = m[1].trim(); valor = brl(m[2]); }
      } else if ((m = /boleto de cobran[cç]a de (.+?) para (\d{2}\/\d{2}\/\d{4})/i.exec(subj))) {
        tipo = 'Boleto a vencer';
        contraparte = m[1].trim(); vencimento = dmy(m[2]);
        const v = /valor de R\$\s*([\d.,]+)/i.exec(sum);
        if (v) valor = brl(v[1]);
      } else continue;
      if (valor == null || Number.isNaN(valor)) continue;
      rows.push({ id: e.id, data, mes: data.slice(0, 7), tipo, contraparte, categoria: tipo === 'Boleto a vencer' ? 'A pagar' : categoria(contraparte, tipo), valor, vencimento, link: e.webLink || null });
    }
    return rows.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  // E-mails da contabilidade enviados pelo Omie
  function parseContabil(messages) {
    const rows = [];
    for (const e of messages) {
      const subj = (e.subject || '').replace(/\s+/g, ' ').trim();
      const sum = String(e.bodyPreview || '').replace(/\r/g, '');
      const comp = /(\d{2})\/(\d{4})/.exec(subj);
      let documento, valor = null, vencimento = null, m;
      if (/^Guia do Simples Nacional/i.test(subj)) {
        documento = 'Guia do Simples (DAS)';
        const v = /no valor de R\$\s*([\d.,]+)/i.exec(sum);
        if (v) valor = brl(v[1]);
        vencimento = dmy((/vencimento em (\d{2}\/\d{2}\/\d{4})/i.exec(sum) || [])[1]);
      } else if (/^Obriga[cç][aã]o do Simples/i.test(subj)) documento = 'Declaração do Simples (sem guia)';
      else if (/^DCTF ?Web/i.test(subj)) documento = 'DCTFWeb / guia do INSS';
      else if (/^Folha/i.test(subj)) documento = 'Folha (pró-labore)';
      else if (/^Documentos cont[aá]beis/i.test(subj)) documento = 'DRE + Balancete';
      else if (/^DRE/i.test(subj)) documento = 'DRE';
      else if (/^Balancete/i.test(subj)) documento = 'Balancete';
      else if ((m = /NFS-e\s+N[ºo°]\s*(\d+)/i.exec(subj))) documento = 'NFS-e de honorários nº ' + m[1];
      else documento = subj;
      rows.push({
        id: e.id, recebido: dia(e.receivedDateTime), documento,
        competencia: /NFS-e/i.test(subj) || !comp ? null : `${comp[2]}-${comp[1]}`,
        valor, vencimento, assunto: subj, link: e.webLink || null,
      });
    }
    const seen = new Set();
    return rows
      .filter((r) => { const k = r.assunto + '|' + r.recebido; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (a.recebido < b.recebido ? 1 : a.recebido > b.recebido ? -1 : 0));
  }

  // Corpo de um "Relatório Movo MM/AAAA"
  function parseRelatorio(competencia, texto, link) {
    const txt = String(texto || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const g = (re) => { const m = re.exec(txt); return m ? brl(m[1]) : null; };
    return {
      competencia,
      faturamento: g(/ENTROU NO M[EÊ]S\s*R\$\s*([\d.,]+)/i),
      impostos: g(/IMPOSTOS\s*R\$\s*([\d.,]+)/),
      simples: g(/Simples Nacional\s*R\$\s*([\d.,]+)/),
      inss_prolabore: g(/INSS do pr[oó]-labore\s*R\$\s*([\d.,]+)/i),
      despesas: g(/DESPESAS\s*R\$\s*([\d.,]+)/),
      honorarios: g(/Honor[aá]rios cont[aá]beis\s*R\$\s*([\d.,]+)/i),
      sobrou: g(/SOBROU NO SEU BOLSO ESTE M[EÊ]S\s*R\$\s*([\d.,]+)/i),
      prolabore_liquido: g(/Sendo\s*R\$\s*([\d.,]+)\s*do seu pr[oó]-labore l[ií]quido/i),
      resultado_empresa: g(/R\$\s*([\d.,]+)\s*de resultado da empresa/i),
      dividendos: g(/Distribu[ií]do em \S+\s*R\$\s*([\d.,]+)/i),
      a_receber: g(/R\$\s*([\d.,]+)\s*do faturamento estavam a receber/i),
      link: link || null,
    };
  }

  function fluxoMensal(banco) {
    const by = new Map();
    for (const r of banco) {
      if (r.tipo !== 'Entrada' && r.tipo !== 'Saída') continue;
      const m = by.get(r.mes) || { mes: r.mes, entradas: 0, saidas: 0, impostos: 0, socio: 0, despesas: 0 };
      if (r.tipo === 'Entrada') m.entradas += r.valor;
      else {
        m.saidas += r.valor;
        if (r.categoria === 'Impostos') m.impostos += r.valor;
        else if (r.categoria === 'Sócio') m.socio += r.valor;
        else m.despesas += r.valor;
      }
      by.set(r.mes, m);
    }
    return [...by.values()].sort((a, b) => (a.mes < b.mes ? -1 : 1))
      .map((m) => ({ mes: m.mes, entradas: r2(m.entradas), saidas: r2(m.saidas), impostos: r2(m.impostos), socio: r2(m.socio), despesas: r2(m.despesas), liquido: r2(m.entradas - m.saidas) }));
  }

  // Guias e boletos, casados com o pagamento correspondente na conta
  function obrigacoes(docs, banco, hoje = hojeSP()) {
    const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    const nextMonth = (c) => { const [y, m] = c.split('-').map(Number); return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`; };
    const pays = banco.filter((r) => r.tipo === 'Saída').map((r) => ({ ...r, usado: false }));
    const ob = [];
    for (const d of docs) {
      if (d.documento === 'Guia do Simples (DAS)' && d.competencia) ob.push({ id: 'das-' + d.competencia, obrigacao: 'Simples Nacional (DAS)', competencia: d.competencia, vencimento: d.vencimento, valor: d.valor, favorecido: 'MINISTERIO DA FAZENDA', desde: d.recebido });
      else if (d.documento === 'DCTFWeb / guia do INSS' && d.competencia) ob.push({ id: 'inss-' + d.competencia, obrigacao: 'INSS do pró-labore (DCTFWeb)', competencia: d.competencia, vencimento: null, valor: null, favorecido: 'MINISTERIO DA FAZENDA', desde: d.recebido });
    }
    const bol = new Map();
    for (const r of banco) {
      if (r.tipo !== 'Boleto a vencer') continue;
      const id = 'boleto-' + r.contraparte + '-' + r.vencimento;
      if (!bol.has(id)) bol.set(id, { id, obrigacao: 'Boleto ' + r.contraparte, competencia: null, vencimento: r.vencimento, valor: r.valor, favorecido: r.contraparte, desde: r.data });
    }
    ob.push(...bol.values());
    const mesmo = (a, b) => { const w = (a || '').toUpperCase().split(/\s+/)[0]; return !!w && (b || '').toUpperCase().includes(w); };
    for (const o of [...ob].sort((a, b) => (a.valor == null) - (b.valor == null))) {
      let p;
      if (o.valor != null) {
        const ini = o.vencimento ? addDays(o.vencimento, -35) : o.desde;
        const fim = o.vencimento || hoje;
        p = pays.find((x) => !x.usado && mesmo(o.favorecido, x.contraparte) && Math.abs(x.valor - o.valor) < 0.01 && x.data >= ini && x.data <= fim);
      } else if (o.competencia) {
        const ini = nextMonth(o.competencia);
        p = pays.find((x) => !x.usado && mesmo(o.favorecido, x.contraparte) && x.data >= ini && x.data <= addDays(ini, 60));
      }
      if (p) { p.usado = true; o.pago_em = p.data; if (o.valor == null) o.valor = p.valor; } else o.pago_em = null;
      o.situacao = o.pago_em ? 'Pago' : o.vencimento && o.vencimento < hoje ? 'Vencido' : o.valor == null ? 'Conferir guia (PDF)' : 'A pagar';
    }
    return ob.sort((a, b) => ((b.vencimento || b.pago_em || '') < (a.vencimento || a.pago_em || '') ? -1 : 1));
  }

  const api = { parseBanco, parseContabil, parseRelatorio, fluxoMensal, obrigacoes, hojeSP };
  if (typeof module !== 'undefined') module.exports = api; else root.CSParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
