# Changelog — V1.5.0-dev4-clean

## Conta e compras
- Saldo positivo passou a ser opcional, desativado por padrão.
- Resumo de compra mostra saldo usado, regularização obrigatória, pagamento externo e saldo final.
- Corrigido cálculo presencial quando o aluno possui saldo negativo.

## Mobile
- Botão de menu interno passou a existir diretamente no HTML.
- Menu lateral restaurado para Cantina, Secretaria, Gestão e Administração.
- Estado aberto/fechado e acessibilidade do botão foram ajustados.

## Checkout
- Adicionado identificador idempotente por tentativa.
- Múltiplos cliques ou repetição da mesma tentativa reutilizam o link existente.
- Novo status `preparando_link`.
- `aguardando_pagamento` somente após a InfinitePay devolver URL.
- Tempos de preparação, persistência e comunicação externa são registrados.
- Chamada externa possui timeout controlado de 15 segundos.
- Corrigido vínculo do checkout de farda com `pedidos_farda`.

## Portal do responsável
- Nova área Pagamentos pendentes.
- Links válidos podem ser retomados.
- Pedidos de cantina expirados orientam refazer a programação.
- Contagem regressiva da reserva de 5 minutos.
