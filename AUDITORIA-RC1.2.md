# Auditoria de correções — V1.5.0 RC1.2

## Decisão do fluxo financeiro

| Situação | Comportamento |
|---|---|
| Saldo cobre 100% | Confirmação interna; não abre dados do comprador nem InfinitePay |
| Saldo cobre parte | Confere dados do comprador; checkout somente pela diferença |
| Usuário preserva o saldo | Confere dados do comprador; checkout pelo valor integral |
| Adicionar crédito ou regularizar saldo | Confere dados do comprador; checkout pelo valor informado |

## Proteção contra links indisponíveis

- Uma ação explícita gera um novo identificador de tentativa.
- O mesmo envio repetido continua idempotente.
- Outra ação para a mesma operação substitui cobranças anteriores ainda ativas.
- O backend valida protocolo e domínio do endereço recebido.
- O frontend repete a validação antes do redirecionamento.
- Links têm uma janela curta de reutilização apenas para repetição técnica da mesma tentativa.

## Programação

- Estados cancelados e remarcados são finais.
- Uma ocorrência final não apresenta botões operacionais.
- Remarcação não apaga o histórico.
- Cancelamento não altera diretamente o saldo final: cria uma movimentação de crédito auditável.

## Interface

Os diálogos nativos foram substituídos por um componente próprio, responsivo e compatível com o visual do sistema. Mensagens técnicas continuam disponíveis nos logs, mas o responsável recebe linguagem operacional.
