# Sistema de Vendas Escola Piaget — RC2.7.2

**Release candidata:** `1.6.0-rc2.7.2-familia-compartilhada`

Construída sobre a RC2.7.1 validada no deploy da Vercel. Esta candidata muda a experiência de famílias com mais de um aluno: a família passa a ser a visão principal e o aluno passa a ser uma atribuição/filtro operacional.

## O que muda

- Meu Piaget abre todos os alunos vinculados ao mesmo responsável em uma única conta familiar.
- Saldo, crédito, dívida, autorização e limite continuam compartilhados pela família.
- Pedidos, movimentações, pagamentos pendentes e notificações são consolidados, com filtro por aluno.
- Programação de lanche aceita um ou vários alunos; para o segundo aluno em diante é possível copiar a programação anterior e editar só o necessário.
- Secretaria trabalha com um único carrinho familiar presencial ou online, podendo misturar itens destinados a alunos diferentes.
- Cada item, farda, programação de lanche ou pedido continua gravado com o aluno correto.
- Ao abrir um aluno em Alunos e Contas, Secretaria/Gestão visualizam a conta familiar e os demais alunos vinculados.
- Cantina recebe visão familiar apenas no escopo operacional de lanches/pedidos.
- Acesso das famílias é gerenciado em Alunos e Contas. O módulo Usuários e Acessos permanece reservado à Gestão para usuários internos da equipe.
- A ficha da família permite gerar imagem de primeiro acesso pronta para WhatsApp.
- Acesso familiar bloqueado pode ser reativado pela Secretaria/Gestão quando já existir senha.
- Página pública de uma venda online identifica operações familiares e mostra o aluno de cada item.

## Segurança do primeiro acesso

A base oficial não grava o CPF completo em texto no frontend/Firestore. O cartão gerado mostra `CPF do responsável •••• 1234` e a matrícula exata escolhida como código de primeiro acesso. O responsável informa o CPF completo que já conhece. Não foi inserido CPF completo no código-fonte enquanto as regras do Firestore permanecem abertas.

## Vercel e Firestore

- `/api` permanece com **10 funções**, abaixo do limite observado de 12 funções do plano Hobby.
- O Marco Zero continua exclusivamente manual e não é executado no deploy.
- As regras atuais do Firestore (`allow read, write: if true`) continuam apropriadas apenas para desenvolvimento. Não liberar o Meu Piaget amplamente para responsáveis externos antes da etapa de segurança.
