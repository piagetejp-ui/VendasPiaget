# Changelog — 1.6.0-rc2.7.4

## Hotfix de prioridade

- Corrigida regressão da ficha de Alunos e Contas (`isBlocked is not defined`).
- Corrigidas referências antigas dos HTMLs para a RC2.7.2 e incluído o módulo 22 no carregamento real.
- Padronizado aluno em Notificações, Vendas, Cobranças e Pedidos: nome clicável + turma, usando o estilo visual de Vendas/Cobranças.
- Removida apresentação em formato de caixa/botão no nome do aluno em Pedidos.

## Família como contexto principal

- Removida a lógica de navegar trocando o “perfil” do aluno no Meu Piaget.
- Famílias com vários alunos agora entram em uma visão consolidada.
- Aluno passa a funcionar como filtro e como destinatário obrigatório das operações.
- Saldo/crédito/dívida/limite permanecem únicos na conta financeira familiar.

## Carrinho e programação multi-aluno

- Meu Piaget: programação de lanche para um ou vários alunos no mesmo checkout.
- Ao escolher vários alunos, configura-se o primeiro e o sistema oferece copiar a programação para o próximo, permitindo ajustes posteriores.
- Secretaria presencial e online: um único carrinho pode conter itens de vários alunos vinculados à mesma conta familiar.
- Cada linha do carrinho mantém `alunoId`, nome, matrícula/turma e vínculo financeiro.
- Backend valida que todos os alunos atribuídos pertencem à mesma conta familiar.
- Estoque, fardamento, agenda da Cantina e pedidos continuam individualizados por aluno.

## Visões consolidadas

- Meu Piaget: pedidos, movimentações, notificações e pagamentos pendentes consolidados com filtro por aluno.
- Secretaria/Gestão: abrir qualquer aluno revela a conta familiar e os demais alunos vinculados.
- Cantina: vínculo familiar disponível na visão operacional de lanches/pedidos, sem ampliar desnecessariamente dados financeiros.
- Página pública de pagamento online exibe a atribuição de cada item quando a operação envolve vários alunos.

## Acessos

- Usuários e Acessos permanece apenas para Gestão/Admin e gerencia usuários internos da Equipe Piaget.
- Secretaria gerencia acesso da família dentro de Alunos e Contas.
- Mantidos geração de link de redefinição e bloqueio; adicionada reativação de acesso existente.
- Adicionado download de imagem de primeiro acesso para envio por WhatsApp.

## Preservações técnicas

- 10 funções serverless em `/api`.
- Marco Zero continua manual.
- Núcleo de `16-cash-responsibility.js` preservado funcionalmente da RC2.7.1.
- Nenhuma regra do Firestore foi fechada automaticamente nesta candidata.
