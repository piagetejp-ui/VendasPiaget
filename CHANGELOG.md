# RC2.7.26 — Cancelamento legível + correção de entrega marcada por engano

Base: **RC2.7.25**, confirmada como publicada após a consolidação das funções da Vercel Hobby.

## O que mudou

### 1. UX de Cancelar / Estornar
- O acionador de **Cancelar / Estornar** deixou de ser um botão vermelho sólido e passou a usar um estilo discreto, com borda e texto de alerta.
- O primeiro modal agora usa fundo neutro e texto de orientação legível.
- As duas opções de cancelamento/reembolso usam cartões brancos, sem uma tela inteira em vermelho.
- A ação destrutiva final usa vermelho suave apenas como sinalização; vermelho forte fica reservado principalmente para erro real.
- A confirmação final passou a usar diálogo neutro/azul, com descrição objetiva do que será revertido.

### 2. Entrega marcada como entregue por engano
- Ao abrir cancelamento ou reembolso, o sistema consulta as `ocorrencias_entrega` vinculadas à venda.
- Se houver ocorrência com status `entregue`, ela aparece nominalmente no modal, com data e itens.
- Para cancelar a venda inteira, cada entrega marcada como `entregue` precisa ser confirmada como **marcada por engano e não efetivamente entregue**.
- O backend aceita `entregue` como reversível somente para os IDs explicitamente confirmados pelo operador.
- Se existir uma entrega realmente realizada e ela não for confirmada como erro, a venda inteira continua bloqueada. Esta release não faz cancelamento parcial de uma venda que já teve consumo real.
- Status como `aluno_ausente` e `nao_entregue` continuam protegidos, porque já podem ter gerado crédito/devolução de capacidade e precisam de tratamento específico para evitar duplicidade.

### 3. Reversão transacional e auditoria
Quando uma entrega `entregue` é confirmada como erro durante o cancelamento:
- a venda é cancelada e os efeitos financeiros/estoque/capacidade seguem a reversão já existente;
- a ocorrência passa para `cancelado`;
- `entregueEm` histórico é preservado;
- são gravados `statusAnteriorCancelamento`, `entregaMarcadaPorEngano`, `entregaEstornadaEm`, operador e motivo;
- a venda grava a lista e a quantidade de entregas corrigidas;
- é criado evento de auditoria `entrega_marcada_por_engano_revertida`;
- é criada notificação de correção para manter equipe e responsável coerentes com a alteração.

## Preservado
- **10 funções serverless**: continua abaixo do limite de 12 do plano Hobby.
- URLs legadas consolidadas continuam preservadas pelos rewrites.
- Firestore Rules não foram alteradas.
- Marco Zero não foi alterado.
- Núcleo de InfinitePay/webhook não foi alterado.
- Reembolso externo continua sendo apenas registrado depois de efetivamente executado fora do Piaget.
