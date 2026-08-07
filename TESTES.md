# Roteiro de testes — 1.6.0-rc2.7.2-familia-compartilhada

## Antes de tudo

- Publicar a candidata inteira.
- Não executar o Marco Zero.
- Não alterar ainda as regras abertas do Firestore.

## 1. Família com um aluno

- Entrar no Meu Piaget com uma família de um aluno.
- Confirmar que a experiência continua simples, sem etapas extras para escolher aluno.
- Abrir saldo, pedidos, movimentações e programação de lanche.

## 2. Família com irmãos / vários alunos

- Entrar com uma conta que tenha dois ou mais alunos.
- Confirmar que todos aparecem juntos na página inicial; não deve existir troca de “perfil de aluno”.
- Confirmar saldo/limite únicos da família.
- Abrir Pedidos, Movimentações, Pagamentos pendentes e Notificações; testar `Todos` e filtros individuais.

## 3. Lanche multi-aluno no Meu Piaget

- Escolher Programar lanches.
- Selecionar dois alunos.
- Montar a programação do primeiro.
- No segundo, usar `Copiar programação de ...`.
- Alterar pelo menos um item/data do segundo para confirmar independência.
- Revisar a compra: deve existir uma única operação/checkout, com os dois alunos identificados.
- Depois da confirmação, verificar pedidos/agendas individualizados para cada aluno.

## 4. Secretaria — carrinho familiar presencial

- Abrir Vendas e pesquisar um aluno que tenha vínculo familiar.
- Confirmar que os demais alunos da conta ficam disponíveis.
- Adicionar itens destinados a alunos diferentes no mesmo carrinho (ex.: serviço/mensalidade para um, farda para outro e lanche para outro).
- Confirmar que cada linha mostra o aluno destinatário.
- Fechar em uma única operação presencial.
- Conferir Alunos e Contas, Pedidos e movimentações.

## 5. Secretaria — venda online familiar

- Repetir o carrinho com mais de um aluno em canal online.
- Gerar um único link.
- Abrir `pagamento.html` e confirmar que a cobrança informa que é uma operação familiar e identifica o aluno de cada item.
- Não é necessário concluir uma transação real da InfinitePay se o objetivo for apenas validar interface.

## 6. Alunos e Contas / Cantina

- Na Secretaria, pesquisar qualquer aluno de uma família compartilhada.
- Confirmar lista dos alunos vinculados e filtros `Todos / aluno`.
- Conferir saldo familiar e registros operacionais individualizados.
- Na Cantina, abrir/consultar um aluno vinculado e confirmar que aparecem vínculo/filtros apenas no escopo de lanches e pedidos.

## 7. Acessos

- Como Secretaria: confirmar que `Usuários e Acessos` não aparece como módulo separado.
- Em Alunos e Contas, abrir Acesso Meu Piaget; testar geração do link de redefinição, bloqueio e reativação.
- Clicar `Baixar primeiro acesso`; confirmar PNG com aluno, matrícula e indicação do CPF do responsável.
- Como Gestão/Admin: confirmar que `Usuários e Acessos` permanece e lista apenas perfis internos da equipe.

## 8. Regressão do caixa

- Abrir Caixa e confirmar situação/histórico.
- Se possível, realizar uma operação curta já conhecida e validada.
- Não houve mudança funcional intencional em `16-cash-responsibility.js`.
