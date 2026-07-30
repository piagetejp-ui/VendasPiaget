# Changelog — V1.4.1 Checkout Oficial

## V1.4.1

- Base retomada da V1.3.4 aprovada.
- V1.4.0 anterior descartada.
- Criada integração oficial com Checkout Integrado InfinitePay.
- Criados endpoints Vercel:
  - `/api/criar-checkout`;
  - `/api/verificar-pagamento`;
  - `/api/webhook-infinitepay`.
- Criado modelo de conta corrente do aluno:
  - saldo positivo = crédito;
  - saldo negativo = saldo em aberto;
  - saldo zero = regular.
- Mantida compatibilidade com campos antigos:
  - `saldoCreditoCentavos`;
  - `dividaCentavos`.
- Adicionado campo líquido:
  - `saldoContaCentavos`.
- Adicionada regra de valor mínimo:
  - saldo negativo exige pagamento mínimo suficiente para zerar;
  - saldo regular usa mínimo configurável, inicialmente R$ 1,00.
- Adicionado bloqueio semanal:
  - fechamento semanal bloqueia automaticamente contas negativas;
  - regularização desbloqueia automaticamente.
- Adicionada geração de link para:
  - portal do responsável;
  - secretaria;
  - gestão/administração.
- Adicionado pagamento presencial na mesma conta corrente.
- Adicionado painel de pagamentos InfinitePay em Cobranças e saldos.
- Adicionada página `obrigado.html` para retorno e verificação manual.
- Adicionado aviso de pagamentos pendentes antes de gerar novo link.

## V1.4.2 — Checkout: comprovante, retorno automático e extrato

- Adicionada tela de comprovante em `obrigado.html` com resumo do pagamento.
- Adicionado botão para imprimir/salvar PDF pelo navegador.
- Adicionado botão para baixar comprovante em imagem PNG.
- Adicionado botão para abrir comprovante/recibo da InfinitePay quando a API retornar URL.
- Ajustado retorno ao sistema para voltar ao portal do responsável usando a sessão salva no navegador (`/?modo=pai&retornoCheckout=1`).
- Adicionada restauração automática do responsável no retorno do checkout, quando houver sessão local ativa.
- Melhorado extrato da conta do aluno: movimento, forma, detalhes, valor e saldo após lançamento.
- Adicionado botão de comprovante nos lançamentos vinculados ao NSU do checkout.
- Adicionado campo “Dados do comprador” no perfil do responsável: nome, telefone e e-mail para próximos pagamentos.
- Mantida a regra de conta corrente: saldo negativo exige pagamento mínimo para zerar; crédito só entra após confirmação.
