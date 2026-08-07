# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.3

**Release candidata — Fechamento da etapa Secretaria**

Base: `1.6.0-rc2.7.2`.

Esta candidata consolida as observações levantadas durante o teste da RC2.7.2 e fecha, em princípio, o fluxo operacional da Secretaria antes da revisão específica do perfil Cantina.

## Principais ajustes

- **Extrato e Movimentações:** registros técnicos de venda + pagamento pertencentes à mesma operação da Secretaria são exibidos como uma única operação econômica. Os registros originais continuam preservados para auditoria.
- **Login da Equipe Piaget:** formulário interno de e-mail/senha centralizado, sem o espaço residual do antigo acesso dividido com responsáveis.
- **Aluno padronizado:** referência de aluno passa a apresentar **nome + turma atual + clique para a ficha**, inclusive em notificações e nas principais listas operacionais.
- **Pedidos:** dois níveis de indicadores:
  - cards gerais de urgência acima das categorias;
  - cards específicos da categoria selecionada abaixo das categorias.
  Todos os cards funcionam como filtros.
- **Alunos e Contas:** ação **Lançar pendência anterior** para registrar operações reais que ficaram fora do sistema, inclusive com data retroativa, aluno, categoria, descrição, quantidade, valor e situação operacional.
- **Conta familiar:** uma pendência manual atualiza o saldo da família, cria o registro/pedido correspondente e fica visível no Meu Piaget.
- **Fechamento semanal familiar:** prévia das contas negativas, bloqueio em lote, fotografia das pendências, acompanhamento por família, PDF individual para WhatsApp, marcação de envio e regularização/desbloqueio automático quando a conta volta a ficar regular.
- **Versão na interface:** passa a aparecer somente como `1.6.0-rc2.7.3`, sem nomes promocionais ou mensagens como “Família Compartilhada”.

## Regras preservadas

- A família é a unidade financeira; o aluno é a unidade operacional e de atribuição.
- Carrinho familiar multi-aluno da RC2.7.2 permanece.
- Meu Piaget continua com visão consolidada da família e filtros por aluno.
- “Usuários e Acessos” continua reservado à Gestão para usuários internos; a Secretaria administra acessos familiares em Alunos e Contas.
- O Marco Zero continua **manual** e não é executado no deploy.
- O núcleo do caixa físico (`16-cash-responsibility.js`) não recebeu mudança funcional nesta candidata.
- `/api` permanece com **10 funções serverless**.

## Fechamento semanal

O fechamento semanal **não cria uma nova dívida**. Ele apenas registra uma fotografia das contas familiares que já estão negativas, aplica o bloqueio semanal e abre a fila de acompanhamento da cobrança.

Cada família recebe um único documento. Quando houver mais de um aluno, as pendências são agrupadas por aluno no PDF. O documento orienta o responsável a regularizar pelo Meu Piaget ou solicitar à Secretaria um link direto de pagamento.

## Segurança antes da abertura externa

As regras do Firestore atualmente informadas continuam abertas para desenvolvimento (`allow read, write: if true`). Esta candidata não altera essas regras automaticamente. O Meu Piaget não deve ser liberado amplamente aos responsáveis antes da etapa específica de segurança.
