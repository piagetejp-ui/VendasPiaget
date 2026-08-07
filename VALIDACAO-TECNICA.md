# Validação técnica — 1.6.0-rc2.5.1-fardamento-variacoes

## Base preservada

A RC2.5.1 foi construída sobre a RC2.5 já publicada e testada pelo usuário sem incorreções identificadas até o momento. O arquivo `16-cash-responsibility.js`, que contém o núcleo validado do caixa físico, foi comparado com a RC2.5 e permanece funcionalmente idêntico, exceto pela identificação da nova versão.

## Verificações locais

- Sintaxe de todos os JavaScripts de frontend e APIs com `node --check`.
- Parse de todos os arquivos JSON.
- Validação dos caminhos referenciados pelo `index.html`.
- Validação dos arquivos listados no precache do service worker.
- Comparação do núcleo do caixa RC2.5 × RC2.5.1.
- Verificação estática das novas regras de destinatários e estados das notificações.
- Verificação estática das classificações financeiras de saída do caixa.
- Verificação do detalhamento do carrinho e da programação por data.
- Teste HTTP/local do pacote após empacotamento.
- Integridade CRC do ZIP final.


## Validações específicas do fardamento

- Produto canônico único `Camisa de farda`.
- 16 variações previstas: 6 Infantil/Juvenil, 5 Feminino/Baby Look e 5 Masculino.
- Estoque-base informado totaliza 35 camisas físicas.
- Tamanhos sem estoque permanecem visíveis no portal, mas desabilitados.
- Quantidade selecionada é limitada pelo disponível no frontend.
- Backend revalida variação e estoque para portal, venda presencial e venda online da Secretaria.
- Rotas legadas de fardamento da Secretaria também passam pela validação de estoque.
- Criação de um segundo item de fardamento no catálogo é bloqueada/redirecionada para o produto único.

## Limite da validação

Não foi realizado deploy desta RC2.5.1 e os novos fluxos de fardamento não foram executados contra o Firestore real do usuário. A versão deve ser tratada como **candidata para teste real**, não como release final validada.
