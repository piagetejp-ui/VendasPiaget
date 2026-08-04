# Roteiro de testes — V1.5.0 RC1.2

Use primeiro a URL exclusiva do deploy da Vercel.

## 1. Pedido integralmente pago pelo saldo

1. Entre com um aluno que tenha saldo suficiente.
2. Monte um pedido da cantina e ative **Usar saldo**.
3. Confirme que o pagamento externo é R$ 0,00.
4. Toque em **Confirmar pedido**.
5. Verifique: pedido confirmado, saldo reduzido, entrega criada e nenhuma página da InfinitePay aberta.
6. Atualize a página e confirme que a operação não foi duplicada.

## 2. Pedido sem usar saldo

1. Use um aluno com saldo positivo.
2. Monte um pedido e desative **Usar saldo**.
3. Confirme que aparece a etapa **Dados do comprador**.
4. Com dados completos, confirme o resumo e toque em **Continuar para o pagamento**.
5. Verifique que abre um link novo e válido da InfinitePay pelo valor integral.

## 3. Saldo parcial

1. Use saldo menor que o valor do pedido.
2. Ative **Usar saldo**.
3. Confirme que a etapa do comprador mostra apenas a diferença externa.
4. Verifique que a InfinitePay abre pelo valor da diferença.

## 4. Dados do comprador

1. Teste um aluno sem dados salvos.
2. Confirme que não é possível avançar sem nome completo, telefone com DDD e e-mail válido.
3. Preencha e prossiga.
4. Reabra outro checkout do mesmo aluno.
5. Confirme que os dados aparecem em resumo compacto.
6. Toque em **Alterar**, salve novos dados e confira a persistência.

## 5. Outros caminhos de checkout

Repita a conferência dos dados e a abertura da InfinitePay em:

- adicionar crédito;
- regularizar saldo negativo;
- compra de fardamento;
- pedido da cantina.

## 6. Link antigo e nova tentativa

1. Gere um checkout e volte sem pagar.
2. Inicie novamente a mesma operação.
3. Confirme que um novo link é gerado.
4. Verifique que a cobrança anterior deixa de aparecer como ativa ou reutilizável.
5. Confirme que não surge a página “link não disponível”.

## 7. Cancelamento de programação

1. Abra uma programação ativa.
2. Cancele uma entrega futura.
3. Confirme a operação no modal do sistema.
4. Verifique a devolução no extrato e a liberação do estoque.
5. Reabra os detalhes e confirme que a entrega está como **Cancelado pelo responsável**, sem **Alterar data** ou **Cancelar**.

## 8. Remarcação

1. Escolha uma entrega futura ativa.
2. Altere para outro dia útil e disponível.
3. Confirme que a ocorrência antiga aparece como **Remarcado** e mostra a nova data.
4. Confirme que a nova ocorrência aparece como pendente.
5. Teste também data igual, fim de semana, data ocupada e estoque insuficiente.

## 9. Diálogos

Percorra cancelamento, descarte de cobrança e outras ações de confirmação. Nenhuma delas deve abrir balões nativos do navegador.

## 10. Dispositivos

Teste no desktop, Android e iPhone, incluindo abertura do teclado nos dados do comprador e retorno da página da InfinitePay.
