# Sistema de Vendas Escola Piaget — RC2.7.1

**Release:** `1.6.0-rc2.7.1-vercel-hobby-hotfix`

Hotfix construído sobre a RC2.7 para resolver o limite de funções serverless do plano Hobby da Vercel sem remover funcionalidades.

## Alteração principal

- funções serverless em `/api`: **10**;
- rotas de famílias consolidadas em `/api/familias.js`;
- rotas públicas de venda online consolidadas em `/api/venda-online.js`;
- URLs antigas continuam válidas por `rewrites` do Vercel;
- utilitários compartilhados movidos para `/server`, fora da pasta de funções;
- `index.html` corrigido para usar a release atual e abrir a experiência da Equipe Piaget.

## Importante sobre Firestore

As regras fornecidas pelo usuário continuam abertas para desenvolvimento. Não liberar o Meu Piaget para responsáveis externos com `allow read, write: if true`. O endurecimento das regras deve ser feito após auditoria das operações diretas do frontend, para não quebrar os fluxos existentes.
