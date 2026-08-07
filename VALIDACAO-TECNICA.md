# Validação técnica — 1.6.0-rc2.6-pedidos-fardamento

## Base e preservação

A candidata foi construída sobre a RC2.5.1. O arquivo `16-cash-responsibility.js`, que contém o núcleo do caixa físico validado nas versões anteriores, foi comparado byte a byte após normalizar somente a identificação da release e permaneceu idêntico funcionalmente.

## Verificações locais previstas/concluídas antes do empacotamento

- sintaxe de **33 arquivos JavaScript** de frontend e APIs com `node --check`;
- parse de **4 arquivos JSON**;
- conferência de referências locais do `index.html`;
- conferência das **23 entradas** do precache do service worker;
- consistência entre `version.json`, `index.html`, `sw.js` e release física;
- comparação normalizada do núcleo do caixa com RC2.5.1;
- verificação estática da fonte de preço por variação do fardamento;
- verificação estática da regra de produção mínima e compromisso por aluno;
- verificação dos registros de pedidos operacionais e notificações;
- verificação dos filtros sem perda de foco nas telas novas/alteradas;
- teste HTTP local do pacote com resposta 200 para `index.html`, `version.json`, `sw.js` e módulos principais alterados;
- teste de integridade do ZIP final.

## Limite da validação

Os testes feitos aqui são locais/estáticos. Não houve deploy nem execução contra o banco de produção do usuário. A release continua sendo **candidata** até o teste real após publicação.
