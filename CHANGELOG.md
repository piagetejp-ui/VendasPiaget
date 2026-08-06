# Changelog — 1.6.0-rc2.4.1-caixa-page-hotfix

## Correções

- Corrigida a criação automática do primeiro período de responsabilidade para caixas abertos em versões anteriores.
- Substituídas duas referências inválidas a `operadorId` pelo valor correto de `operatorId`.
- A página Caixa agora mostra estado de carregamento durante a consulta ao Firestore.
- Uma falha futura deixa mensagem visível e botão **Tentar novamente**, em vez de uma tela vazia.
- Uma falha ao consultar o caixa não derruba mais a página Vendas; o aviso do caixa passa a falhar de forma isolada.

## Preservado

- Caixa único sem turno.
- Conferência e assunção por novo operador.
- Conta de divergências e decisão gerencial.
- Venda presencial, venda online, portal do responsável e checkout InfinitePay.
