# Changelog — Sistema de Vendas Piaget

## 1.6.0-rc2.7.41 — 11/08/2026

Base: **RC2.7.40**.

### Hotfix: erro `Cannot read properties of null (reading 'id')` ao fechar pedido de lanche
- Causa: no fluxo de programar lanche para mais de um aluno numa mesma venda (`captureSaleSnackV172`/`captureParentSnackV172`), o aluno de destino não era encontrado e a função tentava montar o item do carrinho mesmo assim, quebrando ao ler `student.id` de um valor nulo.
- Corrigido com uma validação explícita, que agora mostra uma mensagem clara ("Não foi possível identificar o aluno desta programação...") em vez do erro técnico cru.
- Também reforçada a proteção contra duplo clique no botão "Adicionar ao carrinho"/"Revisar pedido" desse fluxo — não tinha nenhuma trava nas três camadas de função que esse botão atravessa, mesma categoria do bug já corrigido no caixa (RC2.7.38).

## 1.6.0-rc2.7.40 — 11/08/2026

Base: **RC2.7.39**.

### Hotfix: cancelar movimento não refletia direito no saldo nem na tela de gestão
- Causa raiz: `cashEffectV164` (tela da secretaria) e `v165CashEffect` (Auditoria do caixa, usada pela gestão) **recalculam** o efeito de cada movimento a partir do tipo/valor toda vez que a tela é montada — nenhuma delas sabia que um movimento podia estar marcado como cancelado. Resultado: mesmo com o campo de saldo já ajustado na hora do cancelamento (RC2.7.38), qualquer nova consulta — inclusive a própria tela da secretaria depois de atualizar — recontava o movimento cancelado como se estivesse ativo, e a tela de gestão nunca teve nenhuma noção de cancelamento.
- As duas funções agora retornam efeito zero para um movimento cancelado, então o saldo esperado, entradas, saídas, sangrias e despesas ficam corretos em qualquer tela que consultar os movimentos, de forma consistente.
- A tabela de auditoria da gestão agora também mostra visualmente quando um movimento foi cancelado (selo "Cancelado", valor original riscado, e quem/quando cancelou) — antes ela não distinguia em nada um movimento cancelado de um ativo.

## 1.6.0-rc2.7.39 — 11/08/2026

Base: **RC2.7.38**.

### Hotfix urgente: "Caixa da Secretaria" não abria (`safeJs is not defined`)
- Regressão introduzida na RC2.7.38: o botão "Cancelar" adicionado à lista de movimentos usava uma função (`safeJs`) que existe em outros arquivos do sistema, mas não nesse — cada arquivo só enxerga suas próprias funções internas, então a tela inteira quebrava ao tentar montar a lista de movimentos.
- Corrigido usando o mesmo padrão que o próprio arquivo já usa em outros botões (inserir o ID do Firestore direto, sem função de escape — são IDs gerados pelo sistema, sempre seguros).

## 1.6.0-rc2.7.38 — 11/08/2026

Base: **RC2.7.37**.

### Hotfix: sangria/movimento de caixa duplicado ao clicar duas vezes
- Diagnóstico: **foi falha do sistema, não erro da secretária.** O botão "Confirmar saída"/"Confirmar entrada" não tinha nenhuma proteção contra clique duplo — cada clique disparava um lançamento novo e independente. Se o clique parecesse não ter respondido (rede lenta, etc.) e a pessoa clicasse de novo, o sistema registrava dois movimentos idênticos sem nenhum aviso.
- Corrigido: o botão agora desabilita e mostra "Registrando..." assim que clicado, e só volta a ficar disponível se der erro.

### Melhoria: cancelar um lançamento manual de caixa antes de fechar
- Adicionada a opção **"Cancelar"** em cada entrada/saída manual (sangria, despesa, entrada manual) na tela "Caixa da Secretaria", disponível enquanto o caixa está aberto e você é o responsável atual.
- Cancelar ajusta o saldo esperado do caixa na hora e marca o lançamento como "Cancelado" na lista — o registro não é apagado (fica visível e sinalizado, preservando a auditoria), e o valor deixa de contar no saldo. Movimentos gerados pelo próprio sistema (vendas, abertura de caixa, estornos) não aparecem com essa opção, só os lançamentos manuais.

## 1.6.0-rc2.7.37 — 11/08/2026

Base: **RC2.7.36**.

### Hotfix: vendas lançadas pela cantina na conta do aluno apareciam sem o nome
- `registerAccountConsumption` (tela "Lançar na conta do aluno", usada pelo operador da cantina em Atendimento) gravava a venda e o movimento financeiro só com o `alunoId` — sem o nome, turma ou matrícula do aluno. A lista de Vendas usa o nome como referência principal e só cai pro ID interno quando não acha nada; sem o nome gravado e sem a lista de alunos carregada, ela mostrava algo como "aluno_250603" no lugar do nome. O nome que aparecia embaixo (ex: "Ruan de Jesus Silva") era o **operador da cantina**, não o aluno.
- Corrigido: a venda e o movimento agora gravam nome, turma e matrícula do aluno, do mesmo jeito que os outros fluxos de venda já fazem.
- Reforço geral: `ensureStaffCommerceV221` (usada antes de abrir Vendas, Produtos, Configurações e Atendimento) agora também garante que a lista de alunos está carregada, então mesmo vendas antigas sem o nome gravado direto no registro vão exibir o nome certo pelo cadastro do aluno, em vez de cair no ID.

## 1.6.0-rc2.7.36 — 11/08/2026

Base: **RC2.7.35**.

### Hotfix: perfil do aluno sem nome ao abrir pela Auditoria do caixa
- Ao abrir "Auditoria do caixa" → "Períodos de responsabilidade" → clicar em "Aluno" numa movimentação, o perfil que abria mostrava o ID interno do aluno no lugar do nome, e turma/matrícula em branco — porque essa tela nunca garantia que a lista de alunos (`state.students`) estivesse carregada antes de tentar montar o perfil.
- `openStudentDetailsV162` (o perfil correto/único usado em todo o sistema — não existe um "perfil diferente", era esse mesmo, só sem os dados do aluno carregados) agora garante que a lista de alunos está carregada antes de montar a tela, não importa de qual tela você chegou até ele.
- A tela de auditoria de caixa também passa a carregar essa lista antes de montar a tabela de movimentações, então os links "Aluno" já mostram o nome certo, não um rótulo genérico.

## 1.6.0-rc2.7.35 — 11/08/2026

Base: **RC2.7.34**.

### Hotfix: tela de Pedidos não sincronizava as baixas da cantina para secretaria/gestão
- `loadUnifiedOrdersV166` (tela "Pedidos" usada por secretaria/gestão) só busca dados novos do Firestore na primeira vez que é aberta na sessão. Depois disso, nenhuma ação — nem mesmo a própria secretaria mudando o status de um pedido — forçava uma nova busca; a tela só redesenhava o que já estava em memória. Resultado: quando a cantina dava baixa numa entrega, quem já tinha essa tela carregada só via a atualização recarregando a página inteira.
- Adicionado um botão **"Atualizar"** no topo da tela de Pedidos.
- As ações que mudam o status de um pedido (secretaria atualizando fardamento/serviço, cantina confirmando ou não uma entrega) agora forçam a lista a buscar dado novo em vez de só redesenhar o estado antigo.

## 1.6.0-rc2.7.34 — 11/08/2026

Base: **RC2.7.33**.

### Hotfix: lista de Cobranças/contas bloqueadas incompleta e sem opção de Relatório
- `loadAllFinancialAccountsV221` (usada pela tela de Cobranças ao filtrar "Contas bloqueadas" ou "Saldo em aberto") só consultava a coleção `contas_responsaveis` (contas de família já consolidada). Alunos cuja conta ainda está em `contas_alunos` — sem responsável financeiro vinculado — ficavam completamente de fora da lista, não importa o quanto estivessem bloqueados ou negativos. A função agora busca as duas coleções e junta o resultado.
- Adicionado o botão **"Relatório"** direto nas linhas da lista de Cobranças (contas com saldo em aberto/bloqueadas), do mesmo jeito que já existe dentro da tela "Ver conta" — antes era preciso abrir a conta do aluno individualmente pra chegar até essa opção.

## 1.6.0-rc2.7.33 — 11/08/2026

Base: **RC2.7.32**.

### Hotfix: "Remover bloqueio" não desbloqueava de verdade
- Uma conta pode ficar bloqueada por três motivos independentes: bloqueio manual da secretaria, limite de fiado estourado numa compra, ou bloqueio do fechamento semanal. O botão existente só desligava o bloqueio manual — se o motivo fosse um dos outros dois, a conta continuava bloqueada mesmo depois de clicar em "Remover bloqueio".
- O botão na tela de conta do aluno agora mostra "Desbloquear conta" sempre que há qualquer tipo de bloqueio ativo, e ao clicar limpa os três motivos de uma vez — pensado justamente para o caso de uma negociação/decisão interna liberar o aluno independente da causa original do bloqueio.

## 1.6.0-rc2.7.32 — 11/08/2026

Base: **RC2.7.31**.

### Melhoria: link de pagamento junto com o Relatório de valores em aberto
- Investigado o relato de que o PDF "não emite" para alunos com conta bloqueada: o PDF sempre foi gerado normalmente (sem erro), mas o link dentro dele apontava só para a página inicial genérica do Meu Piaget — sem nenhum link de pagamento de verdade.
- O único lugar que já reunia PDF + link de regularização lado a lado era o painel de Fechamento semanal, que só cobre contas que passaram por aquele fechamento — uma conta bloqueada no meio da semana por estourar o limite numa compra não aparecia lá até o próximo fechamento.
- Adicionado o botão **"Gerar link de pagamento"** na tela de Relatório (`generateReport`, disponível para qualquer aluno com saldo em aberto, bloqueado ou não), reaproveitando a mesma função que já gera o link no painel semanal (`openAccountPaymentV141`). O link não foi embutido dentro do PDF em si — ele expira em 24h e o PDF pode ficar salvo/impresso por mais tempo que isso; o botão gera um link novo, sempre válido, no momento em que é clicado.

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
