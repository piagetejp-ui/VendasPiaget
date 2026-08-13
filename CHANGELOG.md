# Changelog — Sistema de Vendas Piaget

## 1.6.0-rc2.7.31 — 11/08/2026

Base: **RC2.7.30**.

### Hotfix: autorização de consumo da secretaria não chegava na cantina
- A tela "Autorização de consumo" (usada pela secretaria/gestão para liberar um aluno a consumir sem saldo, até um limite) só gravava os campos `consumoCreditoAutorizado`/`limiteConsumoCentavos` no cadastro do aluno.
- A checagem real feita no caixa da cantina (`registerAccountConsumption`) e o resumo de conta em qualquer tela (`getAccount`) sempre leram `autorizadoSemSaldo`/`limiteFiadoCentavos` da conta financeira — um documento e campos completamente diferentes, nunca atualizados por essa tela.
- Resultado: a secretaria autorizava, via o toast de sucesso parecia ter funcionado, mas a cantina continuava vendo a conta bloqueada (ou com o limite antigo).
- `/api/gestao-familias` (`configurar_consumo_aluno`) agora espelha a autorização/limite na conta financeira do aluno na mesma chamada, exatamente como a permissão dada pelo próprio responsável no Meu Piaget já fazia. Continua respeitando a regra existente: se o responsável já assumiu o controle da autorização pelo Meu Piaget, a escola não pode mais sobrescrevê-la.

## 1.6.0-rc2.7.30 — 11/08/2026

Base: **RC2.7.29**.

### Hotfix: perfil cantina sem produtos no Atendimento
- A otimização de leitura que decide quais páginas pré-carregam o catálogo de produtos antes de renderizar (`STAFF_COMMERCE_PAGES`, introduzida na RC2.7.25) incluía `vendas`, `produtos` e `config`, mas não `atendimento` — a tela principal do perfil cantina. Resultado: o catálogo nunca era carregado para esse perfil, deixando "Venda rápida em dinheiro" e "Lançar na conta do aluno" sem nenhum produto pra selecionar.
- `atendimento` foi adicionado à lista de páginas que pré-carregam o catálogo.

## 1.6.0-rc2.7.29 — 11/08/2026

Base: **RC2.7.28**.

### Hotfix: histórico de Vendas da secretaria "travando"/mostrando poucos registros
- Trocar de aba no histórico de vendas (Todas/Presenciais/Online/Pendentes/Concluídas/Canceladas) descartava toda a paginação já carregada e buscava só os 50 registros mais recentes de cada fonte (vendas, links online, checkouts) de novo — inclusive ao voltar para "Todas". Agora a troca de aba é só um filtro em cima do que já foi carregado, sem nova consulta ao Firestore.
- Ao finalizar uma venda nova, a tela às vezes não buscava dado novo e só redesenhava o que já estava em memória. Agora a confirmação de uma venda força a atualização real da lista.
- Reduz de forma relevante o volume de leituras do Firestore nessa tela, já que trocar de aba deixou de custar uma nova consulta.

### Hotfix: fechar/cancelar "Nova venda" caía numa página de vendas errada
- O botão de fechar (X) e o de cancelar do assistente de nova venda chamavam uma versão antiga da tela de vendas (sem abas/filtro), diferente da que é exibida normalmente. Agora usam a mesma função da tela atual, preservando a aba em que o usuário estava — igual já acontecia ao concluir uma venda com sucesso.

### Hotfix: lançamento manual/retroativo não fechava como pago
- Quando uma pendência manual/retroativa era paga (link de regularização de saldo), o saldo da família era creditado corretamente, mas o lançamento e o pedido de origem continuavam marcados como "aguardando pagamento" para sempre.
- Ao confirmar um pagamento de entrada de conta (`entrada_conta_aluno`, InfinitePay ou reconciliação manual), o servidor agora busca as pendências manuais em aberto daquele aluno e quita as mais antigas primeiro, até o valor pago se esgotar, marcando `lançamentos_manuais`, o pedido de origem (`pedidos_operacionais`/`pedidos_farda`) e o movimento de conta correspondentes como `pago` na mesma transação do crédito de saldo.
- Consulta limitada e pontual (só no momento da confirmação do pagamento), sem impacto relevante no volume de leituras do Firestore.

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
