# Smoke test — RC2.7.25

Executar somente depois de a Vercel confirmar o deploy como **Ready/Production**.

## 1. Publicação

- Confirmar que o deployment não apresenta mais o erro de limite de funções.
- Confirmar que `version.json` mostra `1.6.0-rc2.7.25`.
- Não republicar Firestore Rules.

## 2. Acessos básicos

- Gestão entra normalmente.
- Secretaria entra normalmente.
- Meu Piaget entra com um responsável válido.
- Catálogo não aparece vazio por erro de leitura.

## 3. Endpoints consolidados

Fazer uma ação real/segura que percorra cada fluxo disponível no uso normal:

- resumo operacional/dashboard carrega;
- configuração/planejamento de lanche carrega;
- operação presencial simples abre e registra somente se houver uma operação legítima;
- programação de lanche abre sem erro;
- cancelamento só deve ser executado no caso real que já precisa de correção.

## 4. Cancelar / Estornar — prioridade

Na Secretaria > Vendas:

- localizar uma venda concluída com status real `confirmada` ou equivalente;
- confirmar que **Cancelar / Estornar** aparece diretamente na linha quando aplicável;
- abrir o detalhe e confirmar que a ação também aparece ali;
- em Cobranças, localizar pagamento concluído e confirmar a mesma ação quando a venda vinculada puder ser resolvida.

### Caso A — pagamento lançado, dinheiro não recebido

Usar **Pagamento não foi recebido / venda lançada por engano** apenas quando isso for verdade. Conferir aluno, valor e forma antes de concluir.

### Caso B — dinheiro realmente recebido e devolvido

Registrar reembolso somente depois da devolução externa efetiva. Para InfinitePay/Pix/cartão, guardar a referência/comprovante.

## 5. Conferência após cancelamento/reembolso

Conferir:

- venda marcada como cancelada/estornada sem apagar o histórico;
- conta familiar;
- movimentações;
- caixa, quando aplicável;
- pedidos/estoque/programações, quando aplicável;
- Auditoria.

## 6. InfinitePay

- Não alterar o webhook nesta release.
- Fazer apenas uma verificação rápida de que os fluxos existentes continuam acessíveis.

## Critério de aprovação

A RC2.7.25 só deve ser considerada base validada depois de: deploy Ready + acessos básicos funcionando + Cancelar / Estornar visível + pelo menos o fluxo real necessário executado sem regressão transversal.
