# CS Financeiro — app do controle financeiro e contábil

App para celular (Android e iPhone) da **CS SERVICOS ADMINISTRATIVOS LTDA** (CNPJ 69.388.555/0001-59).
Ele entra na sua conta Microsoft (carlos_souzajr@outlook.com), lê os e-mails do banco e da contabilidade e monta:

- **Início:** resumo do mês (entradas, saídas, impostos, valor para o sócio), próximas obrigações e gráfico mês a mês
- **Obrigações:** guias do Simples (DAS), DCTFWeb/INSS e boletos, já conferidos com os pagamentos da conta
- **Extrato:** cada Pix e boleto avisado pela Cora, com filtro e link para o e-mail
- **Contábil:** resultado mensal do relatório da Movo, documentos da contabilidade e cadastro da empresa

Não há servidor: o login e os dados ficam só no seu aparelho, e o app tem apenas permissão de **leitura** de e-mail (Mail.Read).
Ele busca os e-mails novos toda vez que é aberto (e pelo botão ↻); sem internet, mostra os últimos dados salvos.

Para colocar no ar são três passos, uma vez só (uns 15 minutos):

---

## 1. Publicar no GitHub Pages (grátis)

1. Em github.com, crie um repositório novo, por exemplo `cs-financeiro`.
   - O código não tem senha nem dado financeiro (os dados vêm do seu e-mail só no seu celular), então ele pode ser **público**. GitHub Pages em repositório privado exige plano pago.
2. Envie todos os arquivos desta pasta para a raiz do repositório (botão **Add file → Upload files**, arraste tudo, inclusive a pasta `icons`).
3. Em **Settings → Pages**: *Source* = **Deploy from a branch**, branch **main**, pasta **/ (root)** → **Save**.
4. Depois de 1–2 minutos o endereço aparece no topo da página. Será algo como:
   `https://SEU-USUARIO.github.io/cs-financeiro/`
   Guarde esse endereço **exatamente assim, com a barra no final**.

## 2. Registrar o app na Microsoft (grátis)

1. Acesse **https://portal.azure.com** entrando com a conta **carlos_souzajr@outlook.com**.
   Desde 2024 a Microsoft só deixa contas pessoais registrarem apps **dentro de um diretório**. Se o portal disser que você não tem diretório/assinatura, crie a **conta gratuita do Azure** (ela pede cartão só para verificação; o registro de app não gera cobrança). Isso cria o "Diretório Padrão" onde o app vai ficar.
2. Vá em **Aplicativos → Registros de aplicativo → Novo registro**.
   - **Nome:** CS Financeiro
   - **Tipos de conta com suporte:** *Somente contas pessoais da Microsoft*
   - **URI de redirecionamento:** plataforma **Aplicativo de página única (SPA)** e cole o endereço do passo 1 (`https://SEU-USUARIO.github.io/cs-financeiro/`)
   - **Registrar**
3. Na tela do app, copie o **ID do aplicativo (cliente)**.
4. Em **Permissões de API**, confira se existe **Microsoft Graph → User.Read**; clique em **Adicionar uma permissão → Microsoft Graph → Permissões delegadas** e marque **Mail.Read**, **offline_access** e **openid**. Salve. (Não precisa de "consentimento do administrador".)

## 3. Ligar as duas coisas

1. No GitHub, abra o arquivo `config.js` → ícone de lápis → troque `COLE_AQUI_O_CLIENT_ID` pelo ID copiado → **Commit changes**.
2. Espere 1 minuto e abra o endereço do app. Toque em **Entrar com a conta Microsoft** e autorize a leitura dos e-mails.

> Se a tela "Falta configurar" aparecer, ela mostra o endereço exato que precisa estar cadastrado no Azure.
> Se o login der erro de *redirect_uri*, o endereço cadastrado no Azure está diferente do endereço do app (confira a barra final).

---

## Instalar no celular

- **iPhone:** abra o endereço no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android:** abra no **Chrome** → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").

O ícone "CS Financeiro" aparece junto dos outros apps e abre em tela cheia, sem barra do navegador.

## De onde vêm os números

| Origem | Remetente | O que o app lê |
|---|---|---|
| Banco Cora | naoresponda@cora.com.br | Pix enviado, Pix recebido, pagamento confirmado, boleto a vencer |
| Contabilidade (Omie) | noreply@omie.com.br | Guia do Simples (valor e vencimento), DCTFWeb, folha, DRE, balancete, NFS-e de honorários |
| Relatório mensal | contato@movocontabilidade.com.br | "Relatório Movo MM/AAAA": faturamento, impostos, sobrou, pró-labore, dividendos, a receber |

Regras:
- **Não é o saldo bancário:** entra só o que gerou e-mail de aviso.
- Categorias pelo nome: Ministério da Fazenda = impostos; Carlos Antonio de Souza Junior = sócio; Movo = contabilidade.
- Uma obrigação é marcada **Pago** quando existe pagamento ao mesmo favorecido, de mesmo valor, até o vencimento.
- O valor da guia da DCTFWeb só existe no PDF; o app considera paga a guia quando há um Pix ao Ministério da Fazenda no mês seguinte à competência que não corresponde a outra guia.
- Para mudar remetentes ou a data inicial da leitura, edite `config.js`.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html`, `styles.css` | Telas |
| `app.js` | Carrega os dados e desenha as telas |
| `parse.js` | Lê o texto dos e-mails e faz as contas |
| `graph.js` | Busca os e-mails no Outlook (Microsoft Graph, só leitura) |
| `auth.js` | Login Microsoft (OAuth 2.0 + PKCE, sem servidor) |
| `config.js` | ID do app no Azure, remetentes e data inicial |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalação no celular e funcionamento offline |
