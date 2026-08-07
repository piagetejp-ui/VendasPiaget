# Roteiro de testes — 1.6.0-rc2.7.4

## Prioridade

1. Abrir **Alunos e Contas**, pesquisar um aluno e abrir a conta familiar. Não pode aparecer `isBlocked is not defined`.
2. Conferir **Notificações**, **Vendas da Secretaria**, **Cobranças** e **Pedidos**. Em todos, o aluno deve aparecer como **nome clicável + turma logo abaixo**, sem caixa em torno do nome.
3. Em **Pedidos**, clicar no nome do aluno e confirmar abertura da ficha/conta familiar.
4. Em **Vendas** e **Cobranças**, confirmar que a turma aparece mesmo em registros antigos quando o aluno existe na base atual.
5. Fazer uma conferência rápida da ficha familiar e do Caixa para descartar regressão.

## Antes do Marco Zero

Não executar o Marco Zero nesta validação. As regras abertas do Firestore continuam sendo apenas de desenvolvimento.
