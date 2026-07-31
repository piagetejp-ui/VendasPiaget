# Escola Piaget — Sistema de Vendas 1.5.0-dev4.1.1-hotfix

Esta versão mantém integralmente o hotfix financeiro da V1.5.0-dev4.1 e acrescenta atualização nativa de arquivos no navegador.

## Atualização automática

- `index.html`, `obrigado.html` e `version.json` são entregues sem cache.
- Todos os arquivos locais de CSS e JavaScript usam `?v=1.5.0-dev4.1.1-hotfix`.
- O sistema consulta `version.json` ao abrir, voltar para a aba e a cada 60 segundos.
- Quando não existe operação em andamento, a nova versão é carregada automaticamente.
- Se houver formulário, carrinho ou modal aberto, aparece o aviso **Nova versão disponível**, evitando perda do trabalho.
- O número da versão aparece no cabeçalho do sistema.

## Publicação

Suba o conteúdo deste pacote na Vercel normalmente. Não é necessário limpar cache nos aparelhos. Após esta versão ser carregada uma vez, as próximas versões serão detectadas automaticamente, desde que cada pacote futuro atualize `version.json` e o parâmetro `?v=`.

> Observação: uma aba que já estava executando uma versão anterior a este mecanismo pode precisar ser reaberta uma única vez após o primeiro deploy. A partir daí, a detecção fica incorporada ao sistema.
