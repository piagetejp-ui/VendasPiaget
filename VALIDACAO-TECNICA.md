# Validação técnica — V1.5.0-dev5.2.1-financial-hotfix

## Base preservada

- V1.5.0-dev5.2-logo-sharp.
- Logo, CSS mobile, atualização automática e fluxos visuais mantidos.
- Nenhuma nova tela financeira.

## Testes automatizados locais

- Sintaxe de todos os arquivos JavaScript.
- Validação de todos os JSON.
- Conferência dos caminhos físicos da release.
- Transação simulada que rejeita leituras depois da primeira gravação.
- Recuperação do caso Armando: R$ 19,00 + R$ 23,00 − R$ 42,00 = R$ 0,00.
- Segunda execução sem duplicar movimentos.
- Valor divergente bloqueado sem alterar saldo.
- Resposta com `paid: false` bloqueada.
- Atualização usando identificadores já salvos.
- Entrada de crédito e pedido de cantina processados pelo mesmo motor.
- Trava por NSU da transação.

Resultado local: **aprovado**.

## Limite da validação

Não foi possível consultar o Firestore nem a InfinitePay de produção durante a geração do pacote. A recuperação real do pagamento ocorrerá após o deploy e a primeira abertura do sistema.
