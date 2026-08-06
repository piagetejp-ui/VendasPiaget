# Validação técnica — 1.6.0-rc2.5-experiencia-auditoria

## Base preservada

A RC2.5 foi construída sobre a RC2.4.1 testada pelo usuário. O arquivo `16-cash-responsibility.js`, que contém o núcleo validado do caixa físico, foi comparado com a base e permanece funcionalmente idêntico, exceto pela identificação da nova versão.

## Verificações locais

- Sintaxe de todos os JavaScripts de frontend e APIs com `node --check`.
- Parse de todos os arquivos JSON.
- Validação dos caminhos referenciados pelo `index.html`.
- Validação dos arquivos listados no precache do service worker.
- Comparação do núcleo do caixa RC2.4.1 × RC2.5.
- Verificação estática das novas regras de destinatários e estados das notificações.
- Verificação estática das classificações financeiras de saída do caixa.
- Verificação do detalhamento do carrinho e da programação por data.
- Teste HTTP/local do pacote após empacotamento.
- Integridade CRC do ZIP final.

## Limite da validação

Não foi realizado deploy desta RC2.5 e os fluxos não foram executados contra o Firestore real do usuário. A versão deve ser tratada como **candidata para teste real**, não como release final validada.
