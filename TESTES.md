# Testes — RC2.7.6

## 1. Regressão visual/funcional (não pode mudar)

- Equipe: login, sidebar, Resumo, Alunos e Contas, Vendas, Cobranças, Pedidos, Caixa.
- Meu Piaget: login, primeiro acesso, família com irmãos, carrinho, lanche, farda, pedidos, notificações, extrato, dados do comprador, limite, logout.
- Venda online da Secretaria e checkout InfinitePay.
- PDF de primeiro acesso e PDF do fechamento semanal.

## 2. Segurança antes de publicar Rules

- login familiar retorna sessão funcional, sem gravar novo token de sessão em `localStorage`;
- reload mantém acesso pelo cookie;
- logout encerra a sessão;
- reset/troca de senha revoga sessões anteriores;
- autorização/limite continuam salvando com a mesma UX, agora por API;
- equipe só carrega Firestore após validação do backend.

## 3. Segurança depois de publicar `firestore.rules`

- sem login: nenhuma leitura Firestore direta;
- família A: alunos/dados da família A carregam;
- família A: tentativa de ler aluno/documento exclusivo da família B deve falhar;
- família não lê `responsaveis_acesso`, `responsaveis_financeiros`, sessões, resets ou auditoria;
- família não altera saldo/dívida diretamente;
- família consegue salvar dados do comprador e marcar suas notificações como lidas;
- Gestão, Secretaria e Cantina ativas continuam operando;
- funcionário bloqueado deixa de operar.

## 4. Pagamentos

- checkout com saldo parcial;
- checkout 100% externo;
- confirmação por webhook/verificação;
- nenhum pagamento é aplicado duas vezes;
- descrição InfinitePay continua identificável por aluno/família;
- retorno da InfinitePay continua funcionando com cookie/session independentemente do redirect.

## 5. Caixa

Executar apenas smoke test. O arquivo `16-cash-responsibility.js` não deve sofrer mudança funcional nesta release.
