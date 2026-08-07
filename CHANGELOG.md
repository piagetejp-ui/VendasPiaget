# Changelog — 1.6.0-rc2.7.1-vercel-hobby-hotfix

## Hotfix de implantação Vercel Hobby

- Redução de 14 endpoints executáveis / 17 arquivos JS sob `api` na RC2.7 para **10 funções reais em `/api`**.
- Consolidação de acesso Meu Piaget, gestão de famílias e implantação em `api/familias.js`.
- Consolidação de obter/iniciar/gerenciar venda online em `api/venda-online.js`.
- Compatibilidade preservada por rewrites das URLs antigas.
- Helpers e base oficial movidos para `/server`, evitando que sejam tratados como funções serverless.
- Correção do `index.html`, que ainda apontava para assets da RC2.6.
- Nenhuma alteração funcional intencional no motor do caixa, pedidos, fardamento ou conta familiar.
