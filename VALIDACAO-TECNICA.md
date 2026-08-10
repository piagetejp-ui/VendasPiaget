# Validação técnica — 1.6.0-rc2.7.11

## Resultado local

- **24** JavaScripts da release passaram em `node --check`.
- **10** JavaScripts de `/api` passaram em `node --check`.
- **9** JavaScripts de `/server` passaram em `node --check`.
- `sw.js` também passou em `node --check`.
- Total verificado: **44** arquivos JavaScript incluindo o service worker.
- **4** arquivos JSON foram parseados com sucesso.
- `/api` mantém **10** funções físicas, abaixo do limite de 12 observado no plano Vercel Hobby.
- Única release física ativa: `releases/1.6.0-rc2.7.11/`.
- **86** referências locais dos cinco HTMLs principais foram verificadas; **0** arquivo ausente.
- Service worker possui **9** entradas no precache.
- `firestore.rules` possui **156** linhas.

## Preservação da RC2.7.10

Foi feita comparação normalizada, substituindo somente o literal de versão:

- `/api`: **nenhuma diferença funcional** versus RC2.7.10;
- `/server`: **nenhuma diferença funcional** versus RC2.7.10.

Assim, a lógica server-side de checkout, cobrança direta, confirmação e InfinitePay da base validada não foi reescrita nesta candidata.

## Relatórios

O novo `23-document-reports.js` passou por teste isolado com dependências simuladas para:

- Relatório de Vendas;
- Relatório de Cobranças;
- Relatório de Pedidos;
- Relatório de Contas;
- Relatório de Caixa;
- Relatório de Movimentações da Equipe;
- Relatório de Movimentações do Meu Piaget;
- Fechamento de Caixa individual.

Nos mocks, as rotinas chegaram à etapa de salvar os arquivos com os nomes esperados.

## PDF / identidade visual

Foi produzida uma amostra programática A4 do padrão do Relatório de Vendas usando a logo oficial e a paleta Piaget. A amostra foi renderizada para PNG a 160 DPI e inspecionada visualmente. O padrão apresentou:

- logo sem deformação;
- cabeçalho legível;
- linha institucional laranja;
- metadados/filtros;
- totalizadores;
- tabela legível;
- rodapé e paginação sem corte.

Essa amostra valida o padrão visual, não substitui o teste dos PDFs reais em runtime com dados do Firestore. Os seis documentos individuais e os relatórios devem ser gerados e inspecionados no ambiente publicado antes do piloto.

## Status financeiro

As renderizações principal e fallback do Meu Piaget foram verificadas no código para usar:

- **Regular** quando o saldo é não negativo;
- **Pendente** quando o saldo é negativo;
- **Conta bloqueada** como indicação independente.

## Aviso do Caixa em Vendas

O novo módulo observa re-renderizações da página Vendas e recria o aviso do estado real do Caixa quando o componente desaparece. O objetivo específico é preservar o aviso após abrir e fechar/cancelar uma venda pelo X.

Esse comportamento depende de DOM/Firestore reais e deve ser confirmado no deploy conforme `TESTES.md`.

## Segurança

- As Rules restritivas continuam empacotadas.
- Este ZIP **não ativa** as Rules no Firebase.
- Não executar Marco Zero pelo deploy.
- A ativação das Rules continua condicionada à regressão funcional completa desta candidata.
