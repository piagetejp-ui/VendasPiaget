# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.11

**Candidata:** RC2.7.11 — Relatórios, PDFs e refinamentos

Base direta da RC2.7.10, cujo fluxo de cobrança direta foi validado pelo usuário em ambiente publicado. Esta candidata não redesenha checkout, InfinitePay, Caixa, API nem modelo financeiro: concentra a padronização documental e dois refinamentos de interface.

## O que entra nesta candidata

### Relatórios em PDF

O usuário que já possui acesso à página pode emitir o relatório correspondente. O PDF não concede nenhuma permissão adicional e materializa o recorte já visível/autorizado no sistema.

Relatórios disponíveis:

1. **Relatório de Vendas** — respeita o filtro ativo de Vendas.
2. **Relatório de Cobranças** — respeita o filtro ativo de Cobranças.
3. **Relatório de Caixa** — usa o recorte atual do Caixa (dia/mês/ano conforme a visão autorizada).
4. **Relatório de Pedidos** — respeita categoria, situação, indicadores e busca aplicados na página.
5. **Relatório de Movimentações** — disponível na conta familiar e no Meu Piaget, respeitando o filtro por aluno.
6. **Relatório de Contas** — usa a busca ativa de Alunos e Contas e consolida a unidade financeira familiar.

Os relatórios usam A4, logo oficial da Escola Piaget, paleta azul/laranja do sistema, cabeçalho simples, filtros utilizados, totalizadores pertinentes, tabela paginada, data/hora e identificação de quem emitiu.

### Documentos e comprovantes

O conjunto documental fica padronizado nos seguintes nomes/funções:

1. **Comprovante de Venda** — composição e liquidação de uma venda específica.
2. **Comprovante de Pagamento** — comprovação de uma movimentação/pagamento específico.
3. **Fechamento de Caixa** — sessão específica, responsáveis e movimentos.
4. **Demonstrativo de Valores em Aberto** — conta financeira familiar e pendências agrupadas por aluno.
5. **Comunicado de Regularização** — documento familiar produzido no fechamento semanal.
6. **Primeiro Acesso ao Meu Piaget** — CPF do responsável + matrícula no primeiro acesso; depois CPF + senha criada.

O nome financeiro legado **Conta da Cantina** deixa de ser usado nos documentos financeiros.

## Refinamentos de interface

### Status financeiro no Meu Piaget

O status principal da conta passa a ser somente:

- **Regular** — saldo não negativo;
- **Pendente** — saldo negativo.

Bloqueio é uma condição separada e pode aparecer junto de **Pendente**. A conta não deve ser apresentada como “Confirmado”, “Aguardando pagamento” ou “Cancelado”.

### Aviso do Caixa na página Vendas

O estado do Caixa da Secretaria é um aviso permanente da página Vendas. Abrir uma nova venda e fechar/cancelar pelo X não deve remover o aviso. Ele só muda quando o estado real do caixa mudar.

Com caixa fechado, continuam disponíveis Pix, cartão e saldo; apenas Dinheiro depende de caixa aberto sob responsabilidade do operador.

## Domínios

- Responsáveis: `https://meupiaget.com.br`
- Equipe: domínio técnico da Vercel já utilizado pelo projeto

O roteamento corrigido na RC2.7.9 permanece preservado.

## Compatibilidade preservada

- cobrança direta validada na RC2.7.10;
- venda online da Secretaria;
- checkout/retorno InfinitePay;
- conta financeira familiar;
- carrinho multi-aluno;
- Caixa único da Secretaria e períodos de responsabilidade;
- 10 funções físicas em `/api` para o plano Vercel Hobby;
- Marco Zero continua manual.

A comparação normalizada de `/api` e `/server` com a RC2.7.10 não mostrou alteração funcional nesta candidata.

## Segurança

As Firestore Rules restritivas continuam incluídas, mas **não devem ser ativadas somente por publicar este ZIP**. Primeiro faça a regressão funcional da RC2.7.11, incluindo PDFs e pagamentos; depois siga `GUIA-ATIVACAO-SEGURANCA-RC2.7.11.md`.
