# Smoke Test — RC2.7.26

## 1. Deploy
- Confirmar `Ready` na Vercel.
- Confirmar que não voltou o erro de limite de funções. A release mantém 10 arquivos físicos em `/api`.
- Não republicar Firestore Rules.

## 2. Visual de Cancelar / Estornar
Em **Secretaria → Vendas**:
- localizar uma venda concluída;
- confirmar que `Cancelar / Estornar` está visível, mas não aparece como um bloco vermelho sólido;
- abrir a ação;
- confirmar que o modal está legível, com fundo neutro e duas opções claras;
- vermelho forte deve ficar restrito a erro real; a ação final usa apenas sinalização suave.

Repetir a conferência em **Cobranças** para um pagamento concluído vinculado a uma venda.

## 3. Caso prioritário — entrega marcada por engano
Usar uma venda em que a Cantina tenha marcado a ocorrência como `entregue`, mas o lanche não tenha sido efetivamente entregue.

1. Abrir `Cancelar / Estornar`.
2. Escolher o fluxo financeiro correto.
3. Confirmar que o sistema mostra a entrega marcada como `Entregue`, com data e itens.
4. Marcar explicitamente: **foi marcada como entregue por engano e não foi realmente entregue**.
5. Concluir o cancelamento.
6. Conferir:
   - venda = `cancelada`;
   - ocorrência = `cancelado`;
   - `statusAnteriorCancelamento = entregue`;
   - `entregaMarcadaPorEngano = true`;
   - `entregaEstornadaEm` e operador preenchidos;
   - conta familiar/movimentos financeiros coerentes;
   - pedido e capacidade/estoque coerentes;
   - Auditoria contém a venda cancelada e `entrega_marcada_por_engano_revertida`;
   - Dashboard/agenda não continuam contando a ocorrência como entrega concluída após atualização;
   - notificação de correção registrada.

## 4. Trava de segurança — houve entrega real
Se uma mesma venda tiver duas ocorrências marcadas como `entregue`, mas uma delas foi realmente entregue:
- **não confirmar** a ocorrência realmente entregue como erro;
- o sistema deve impedir o cancelamento integral da venda;
- não deve haver reversão financeira, de estoque ou de capacidade nessa tentativa.

A RC2.7.26 não implementa cancelamento parcial de uma venda que já teve consumo real.

## 5. Outros status finais
Uma ocorrência `aluno_ausente` ou `nao_entregue` deve continuar bloqueando o cancelamento integral automático, pois esses fluxos podem já ter devolvido crédito e liberado capacidade.

## 6. Reembolso
Para venda cujo valor realmente entrou:
- registrar reembolso somente depois da devolução externa efetiva;
- confirmar forma e referência/comprovante quando aplicável;
- se uma entrega foi apenas marcada por engano, o mesmo seletor de correção deve aparecer e funcionar;
- se houve entrega real, não declarar a entrega como erro.

## 7. Regressão curta
Confirmar rapidamente:
- Catálogo abre;
- Dashboard abre;
- Auditoria abre;
- Pedidos/Cantina abre;
- Vendas abre;
- Cobranças abre;
- Meu Piaget continua acessível;
- checkout/InfinitePay não foi alterado nesta release.
