// Configuração do app. Preencha CLIENT_ID com o "ID do aplicativo (cliente)"
// do registro feito no portal do Azure (veja o README).
window.CS_CONFIG = {
  CLIENT_ID: 'COLE_AQUI_O_CLIENT_ID',
  // Deixe vazio para usar o endereço onde o app está publicado.
  // Ele precisa ser idêntico ao "URI de redirecionamento" (SPA) do registro no Azure.
  REDIRECT_URI: '',

  EMPRESA: 'CS SERVICOS ADMINISTRATIVOS LTDA',
  CNPJ: '69.388.555/0001-59',

  // Remetentes lidos na caixa de entrada
  REMETENTE_BANCO: 'naoresponda@cora.com.br',
  REMETENTE_CONTABIL: 'noreply@omie.com.br',
  REMETENTE_RELATORIO: 'contato@movocontabilidade.com.br',

  // Lê e-mails a partir desta data
  DESDE: '2026-09-01',
};
