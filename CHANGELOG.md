# Changelog — Sistema de Vendas Piaget

## 1.6.0-rc2.7.28 — 11/08/2026

Base: **RC2.7.27**.

### Hotfix: venda presencial de fardamento
- Corrigido `ReferenceError: nome is not defined` em `addUniformStockRequirement()`.
- O requisito de estoque da farda agora grava corretamente `nome: name`.
- Incluído teste de execução da normalização de uma venda presencial de camisa, com preço e estoque de variação simulados.

### Hotfix: Cancelar / Estornar
- Corrigido `ReferenceError: detalhes is not defined` no envio do cancelamento pelo frontend.
- O campo visual `details` agora é enviado ao backend como `detalhes: details`.
- Preservado o fluxo da RC2.7.26 para corrigir, durante o cancelamento, entrega marcada como `entregue` por engano.

### Meu Piaget: leitura familiar segura pelo backend
- Criada uma camada de dados do portal dentro da função física já existente `/api/familias`, via `?modulo=dados`.
- A sessão familiar HttpOnly é validada no servidor; o servidor deriva novamente o responsável e os alunos vinculados e não confia em IDs enviados pelo navegador para definir propriedade dos dados.
- Movimentações/histórico, pedidos, pagamentos pendentes, avisos da página inicial, programação de lanches e notificações passam a usar a camada familiar segura onde havia consultas diretas suscetíveis a `Missing or insufficient permissions`.
- Abrir notificação, marcar uma notificação como lida e marcar todas como lidas também passam pelo backend no Meu Piaget.
- Acesso da equipe continua usando os caminhos já existentes; a mudança é específica ao modo responsável.
- Nenhuma Firestore Rule foi ampliada para contornar o erro.

### Infraestrutura preservada
- 10 funções físicas em `/api` — abaixo do limite de 12 observado no Vercel Hobby.
- `firestore.rules` byte a byte igual à RC2.7.27.
- Marco Zero não alterado.
- Núcleo de checkout/InfinitePay e webhook não alterados.
- Consolidação de endpoints da RC2.7.25 preservada.
