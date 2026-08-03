# Validação técnica — V1.5.0-dev5.1-logo-hotfix

Executado antes da geração do pacote:

- Sintaxe de todos os módulos JavaScript, APIs e service worker com `node --check`.
- Validação JSON de `package.json`, `version.json` e `vercel.json`.
- Conferência de todos os caminhos locais do `index.html`.
- Ausência dos caminhos genéricos antigos `/js/` e `/css/`.
- CSS analisado com `tinycss2`: sem erros de parsing.
- Remoção das media queries históricas e manutenção de uma camada mobile canônica.
- Verificação da presença de `viewport-fit=cover`, `visualViewport`, `pageshow`, service worker e arquivos físicos versionados.
- Verificação do logout canônico.
- Verificação dos textos `Atualizar status` e `Atualizar pagamento`.
- Verificação do hotfix financeiro: leituras de pedido, conta e estoque acontecem antes da primeira gravação na transação de fardamento.
- Conferência de existência dos ativos da marca incluídos no pacote.

Limites desta validação: login Firebase, Firestore real, Safari/iPhone real e InfinitePay real dependem do deploy na Vercel e devem seguir o roteiro de Preview.
