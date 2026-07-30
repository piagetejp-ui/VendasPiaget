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
