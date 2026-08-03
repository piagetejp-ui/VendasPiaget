# Changelog — V1.5.0-dev5-rebuild

## Publicação e atualização

- Criada pasta física e imutável para os arquivos da versão.
- Removido o carregamento por nomes genéricos `/js/*.js` e `/css/app.css`.
- Adicionado `version.json` sem cache.
- Adicionado service worker com atualização e remoção do cache anterior.
- Adicionada verificação ao abrir, focar, voltar à aba, recuperar conexão e restaurar página pelo `pageshow`.
- Versão visível também no celular.

## Reconstrução responsiva

- Removidas 20 media queries históricas conflitantes do CSS herdado.
- Criada uma única camada responsiva canônica para tablet e celular.
- Restaurado o layout-base com cabeçalho claro, identidade azul/laranja e menu lateral azul.
- Adicionado suporte às áreas seguras do iPhone.
- Removido `100dvh`; modais usam a altura real da viewport visual.
- Navegação interna mobile refeita como menu lateral.
- Tabelas operacionais ganham apresentação em cartões no celular.
- Grades, formulários, assistentes de venda, pedidos, caixa, notificações e auditoria foram adaptados.

## Preservado

- Conta corrente única do aluno.
- Uso opcional do saldo.
- Pedidos de Cantina e Fardamento.
- Pagamentos pendentes e atualização de status.
- Agenda da cantina e estoque de salgados.
- Venda presencial da secretaria e troco como crédito.
- Logout canônico.
- Hotfix financeiro: todas as leituras do pedido de fardamento acontecem antes das gravações na transação do Firestore.
