# Changelog — 1.6.0-rc2.7.11

## Relatórios e PDFs

- Adicionado módulo documental `23-document-reports.js`.
- Adicionado botão **Emitir PDF** nas páginas autorizadas de Vendas, Cobranças, Caixa, Pedidos e Alunos e Contas.
- Relatório de Vendas respeita o filtro ativo de canal/situação.
- Relatório de Cobranças respeita o card/filtro ativo.
- Relatório de Caixa respeita a visão autorizada de dia, mês ou ano.
- Relatório de Pedidos usa somente os pedidos atualmente visíveis após categoria, situação, indicador e busca.
- Relatório de Movimentações pode ser emitido na conta familiar da Equipe e no Meu Piaget, respeitando o filtro por aluno.
- Relatório de Contas consolida famílias e usa a busca ativa de Alunos e Contas.
- Criado padrão simples A4: logo oficial, paleta Piaget, metadados, totalizadores, tabela paginada e rodapé com emissão/usuário/página.
- Fechamento de uma sessão de caixa recebe opção **Baixar fechamento em PDF**.

## Documentos individuais

- `Conta da Cantina` deixa de ser o nome de documento financeiro e passa a **Demonstrativo de Valores em Aberto**.
- Demonstrativo passa a trabalhar com a conta familiar e a agrupar pendências por aluno quando houver irmãos vinculados.
- Fechamento semanal passa a gerar **Comunicado de Regularização**.
- Primeiro Acesso ao Meu Piaget explicita responsável financeiro, CPF para login, matrícula e instruções de ativação.
- Comprovante de Venda teve proporção da logo corrigida no cabeçalho e nas páginas de continuação.
- Comprovante de Pagamento preserva a identidade documental Meu Piaget/Escola Piaget já existente.

## Meu Piaget

- Situação financeira principal padronizada para **Regular** ou **Pendente**.
- `Conta bloqueada` é apresentada separadamente como condição da conta.
- Removido o uso visual de estados de pedido/pagamento como status global da conta.

## Vendas / Caixa

- O aviso do estado do Caixa da Secretaria volta a ser inserido sempre que Vendas é re-renderizada.
- Fechar/cancelar uma nova venda pelo X não remove mais definitivamente o aviso de caixa fechado/aberto.
- Regra financeira preservada: caixa fechado bloqueia somente Dinheiro; Pix, cartão e saldo continuam disponíveis.

## Compatibilidade técnica

- Base: RC2.7.10, validada pelo usuário para cobrança direta.
- `/api` e `/server`: sem diferenças funcionais versus RC2.7.10 após normalizar apenas o número da versão.
- 10 funções serverless físicas em `/api`.
- Nenhuma ativação automática das Firestore Rules.
- Marco Zero continua manual.

---

## Histórico resumido

### RC2.7.10 — hotfix de cobrança direta
- Corrigido **Gerar cobrança / Regularizar saldo** na Gestão e no Meu Piaget.
- Removida dependência não pública que podia encerrar silenciosamente o fluxo após o modal do comprador.
- Tratamento de erro visível preservado.

### RC2.7.9 — hotfix de domínio
- Corrigido `meupiaget.com.br/` para abrir o Meu Piaget sem expor a tela da Equipe.
- Domínio técnico da Equipe preservado.

### RC2.7.8 — domínio e experiência pré-operação
- Centralização dos links públicos em `meupiaget.com.br`.
- Retorno da InfinitePay ao Meu Piaget.
- PDFs familiares, notificações, rascunho de venda presencial e refinamentos da experiência do responsável.
