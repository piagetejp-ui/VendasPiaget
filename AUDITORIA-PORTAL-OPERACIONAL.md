# Auditoria do portal operacional — 1.5.0-dev5.2.3-operational-portal

## Matriz de rotas

| Operação | Entrada do portal | API | Situação no pacote |
|---|---|---|---|
| Adicionar crédito / pagar saldo | `openParentPaymentV151` | `/api/criar-checkout` (`entrada_conta_aluno`) | Conectada |
| Fardamento | `submitParentUniformV151` | `/api/criar-checkout` (`pedido_farda`) | Conectada |
| Cantina | `submitParentOrderV151` | `/api/criar-checkout` (`pedido_cantina`) | Conectada após correção da revisão |
| Retomar cobrança | Pagamentos pendentes | URL salva no checkout | Conectada |
| Atualizar pagamento | `verifyParentPendingV154` | `/api/verificar-pagamento` | Conectada |
| Descartar cobrança | `discardParentPendingV155` | `/api/descartar-cobranca` | Conectada |

## Correção estrutural

O planejador passou a expor somente `window.PiagetOrderPlanner`, com seleção normalizada, rascunho, restauração e atualização. O módulo de vendas não chama mais funções privadas do módulo de agenda.

## Itens removidos

- checkout avulso de teste;
- rotina automática específica do pagamento antigo;
- página de harness;
- fluxo legado de fardamento do responsável;
- tutoriais extensos nas telas principais.

## Pendência arquitetural futura

A autenticação assinada do responsável nas APIs continua recomendada como etapa de segurança independente. Ela não foi misturada a esta correção funcional para evitar alterar o modelo de acesso durante a estabilização do portal.
