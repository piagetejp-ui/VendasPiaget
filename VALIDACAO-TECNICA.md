# Validação técnica — 1.5.0-dev5.2.3-operational-portal

## Resultado local

- Sintaxe Node verificada em todos os módulos e APIs.
- Integridade do ZIP verificada.
- Todos os caminhos de scripts, CSS, imagens e service worker conferidos.
- `reviewParentOrderV150` não chama mais função privada de outro módulo.
- Existe um único contrato `window.PiagetOrderPlanner`.
- Fluxo de revisão usa itens normalizados, sem referências a elementos removidos do DOM.
- Checkout público de teste, harness e rotina específica do Armando foram removidos.
- Quantidade máxima e validações de catálogo/farda aplicadas no servidor.
- Todos os manipuladores inline (`onclick`, `onchange` e `oninput`) foram conferidos contra funções existentes.
- O filtro de solicitações de redefinição de senha, antes sem função correspondente, foi implementado.
- A venda presencial da secretaria permaneceu conectada após a compactação da tela.
- Smoke test em runtime confirmou seleção, cálculo, criação do payload e abertura da revisão do pedido.

## Limitação

A validação real de Firestore e InfinitePay depende do deploy em Preview/produção. A versão não cria cobranças durante os testes locais.
