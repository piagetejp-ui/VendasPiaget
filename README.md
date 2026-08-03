# Escola Piaget — Sistema de Vendas V1.5.0-dev5-rebuild

Esta versão reconstrói a camada de publicação e responsividade, preservando os fluxos funcionais e o hotfix financeiro da V1.5.0-dev4.1.

## Como publicar

1. Descompacte o pacote.
2. Envie **todo o conteúdo da pasta** `vendas-piaget-v1.5.0-dev5-rebuild` para o projeto da Vercel.
3. Aguarde o deploy ficar `Ready`.
4. Abra o domínio oficial.

Na migração para esta versão, uma aba antiga que já estava aberta no iPhone pode precisar ser fechada e aberta uma única vez. Depois que a dev5 carregar, o próprio sistema verifica novas versões ao abrir, ao retornar à aba, ao restaurar uma página no iPhone e periodicamente.

## Atualização automática

- O HTML e o arquivo `version.json` são entregues sem cache.
- JavaScript e CSS ficam em uma pasta física exclusiva da versão:
  `/releases/1.5.0-dev5-rebuild/`.
- Um service worker procura a versão nova e remove o cache da versão anterior.
- O evento `pageshow` trata páginas restauradas pelo Safari/iPhone.
- A versão carregada permanece visível no cabeçalho e no menu mobile.

## Mobile e iPhone

- `viewport-fit=cover` e áreas seguras do iPhone.
- Altura baseada em `visualViewport`, sem `100dvh`.
- Menu lateral único para usuários internos.
- Modais adaptados ao teclado e às barras do Safari.
- Tabelas operacionais convertidas em cartões no celular.
- Inputs com 16 px para evitar o zoom automático do iPhone.

## Arquivos importantes

- `index.html`: estrutura principal sem cache.
- `version.json`: versão publicada.
- `sw.js`: atualização automática.
- `releases/1.5.0-dev5-rebuild/`: CSS e JavaScript físicos da versão.
- `api/`: APIs Vercel e hotfix financeiro.
- `vercel.json`: regras de cache.
