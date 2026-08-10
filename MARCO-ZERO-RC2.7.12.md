# Marco Zero — RC2.7.12

## Corte oficial

- Data local: **10/08/2026 00:00**
- Timezone: `America/Fortaleza`
- ISO armazenado: `2026-08-10T03:00:00.000Z`

## Regra

- até 09/08/2026: teste antigo, sujeito a arquivamento;
- a partir de 10/08/2026: implantação piloto, preservar;
- sem data confiável: preservar por segurança;
- documento anterior ao corte, mas relacionado a operação pós-corte: preservar para manter integridade referencial.

## Conta familiar

O Marco não zera mais a conta familiar. Antes da alteração, salva snapshot de `contas_responsaveis`. Depois, reconstrói `saldoContaCentavos`, `saldoCreditoCentavos` e `dividaCentavos` pela soma do impacto das movimentações de `movimentos_conta` classificadas como pós-corte.

A autorização de compra sem saldo, limite escolhido e bloqueio manual atuais são preservados. Bloqueio semanal só permanece se houver marca temporal pós-corte; bloqueios semanais antigos são removidos.

## Procedimento de uso

1. Publicar a RC2.7.12.
2. Entrar como Gestão.
3. Abrir Configurações → Meu Piaget e implantação.
4. Clicar em **Revisar corte do Marco Zero**.
5. Conferir especialmente os números de **Arquivar**, **Preservar**, **Saldo consolidado após o corte** e **Movimentos pós-corte considerados**.
6. Confirmar que a transação já realizada em 10/08 aparece no grupo preservado e está refletida no saldo projetado.
7. Executar somente quando não houver outra transação sendo processada naquele instante.
8. Digitar `INICIAR OPERAÇÃO REAL` e confirmar.
9. Após a execução, conferir o marco registrado e testar a transação de 10/08 no histórico, conta e comprovantes.

## Observação operacional

A semana continua sendo piloto controlado, mas os dados a partir do corte são dados reais da implantação. Hotfixes posteriores devem preservar esse histórico.
