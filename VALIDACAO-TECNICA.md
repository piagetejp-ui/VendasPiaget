# Validação técnica — 1.6.0-rc2.7.3

## Estrutura

- Única pasta física de release: `releases/1.6.0-rc2.7.3/`.
- Módulo novo: `22-secretaria-finalization.js`.
- Ordem de carregamento: módulo 22 após a camada de família compartilhada e antes do bootstrap.
- `/api` permanece com 10 arquivos JavaScript, abaixo do limite observado de 12 funções da Vercel Hobby.

## Validações locais

- JavaScript externo validado com `node --check` em frontend/API/server.
- `sw.js` validado e precache atualizado para a release atual, incluindo o módulo 22.
- Scripts inline dos HTMLs principais validados.
- JSONs de configuração/build parseados com sucesso.
- Referências locais dos HTMLs verificadas.
- Páginas principais verificadas por servidor HTTP local.
- ZIP final verificado com teste de integridade.

## Testes focados da RC2.7.3

- Consolidação de uma compra da Secretaria testada com os dois registros técnicos em ordens diferentes: venda→pagamento e pagamento→venda.
- Registros não relacionados não são fundidos.
- Impacto líquido da operação familiar preservado no registro visual consolidado.
- Login interno gera o container centralizado esperado.
- Versão visual normalizada para apenas `1.6.0-rc2.7.3`.
- Módulo de fechamento semanal mantém snapshot, envio e regularização separados da criação da dívida.
- Lançamento retroativo registra data de operação e data/hora do registro separadamente.

## Caixa

O conteúdo funcional de `16-cash-responsibility.js` foi comparado com a RC2.7.2, desconsiderando somente o identificador textual de versão. Não houve alteração funcional intencional no núcleo do caixa físico.

## Limitações da validação local

A validação local cobre estrutura, sintaxe e testes isolados. Fluxos que dependem do Firebase publicado, permissões reais, sessão, InfinitePay e dados existentes precisam ser confirmados no deploy antes do Marco Zero.
