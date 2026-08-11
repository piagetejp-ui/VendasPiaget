# Changelog — 1.6.0-rc2.7.25

## Consolidação de funções para Vercel Hobby

Esta release parte da RC2.7.24 preparada e preserva a correção de visibilidade de **Cancelar / Estornar**. A mudança nova é estrutural: reduz as funções serverless publicadas de 14 para 10 para respeitar o limite de 12 funções do plano Hobby.

### Alterações

- Cinco endpoints operacionais foram movidos, sem alteração de lógica, de `/api` para `handlers/`.
- Um único endpoint `/api/operacoes` despacha internamente para esses cinco handlers.
- `vercel.json` mantém as URLs públicas antigas por `rewrites`, evitando alteração no frontend e integrações internas.
- `webhook-infinitepay`, conciliação, checkout e demais endpoints financeiros críticos permanecem separados.
- Firestore Rules permanecem byte a byte iguais à base recebida.
- A release ativa de frontend é uma cópia da RC2.7.24, com apenas o identificador de versão atualizado para RC2.7.25.

### Endpoints consolidados

- `/api/cancelar-venda-presencial`
- `/api/configuracao-operacional`
- `/api/gerenciar-programacao-lanche`
- `/api/registrar-operacao-presencial`
- `/api/resumo-operacional`

---

# Changelog — 1.6.0-rc2.7.16

## Marco Zero por origem da operação

Esta release corrige a classificação do Marco Zero sem alterar autenticação, Firestore Rules, checkout ou InfinitePay.

### Correções

- Programações criadas antes de 10/08 não são mais preservadas apenas porque possuem entregas em 10/08 ou depois.
- `dataChave`, `dataOperacao` e `atualizadoEm` deixam de decidir a origem de operações normais.
- Documentos filhos passam a herdar a classificação da operação raiz quando existe vínculo operacional.
- Lançamentos retroativos reais usam `registradoEm`/`criadoEm` como origem de implantação, preservando pendências antigas lançadas pela Secretaria a partir de 10/08.
- Novos lançamentos retroativos gravam `retroativo: true`, `origem: secretaria_lancamento_manual`, `dataOperacao`, `registradoEm` e `criadoEm` de forma consistente.
- Reconstrução financeira passa a considerar movimentos reais preservados, inclusive retroativos.
- Após o corte, a capacidade futura de salgados é reconciliada para remover efeitos de programações de teste.
- Reservas e compromissos operacionais de farda são reconciliados a partir dos pedidos preservados, sem alterar quantidade física do estoque.
- Tela de revisão separa implantação, retroativos reais e testes a arquivar.

### Preservado sem alteração funcional

- Firestore Rules da RC2.7.15.
- Login de Gestão e Secretaria.
- Login do Meu Piaget.
- `usuarios_auth` e fallback de equipe do piloto.
- `familias_auth` e Custom Token familiar.
- Checkout/InfinitePay.
- Domínios e roteamento.
- PDFs com logo simples.

## Histórico resumido

### RC2.7.15 — isolamento do Meu Piaget nas Rules
- Requisições familiares deixaram de percorrer o trilho de autorização da equipe.

### RC2.7.14 — autenticação consolidada
- Uniu o hotfix funcional da equipe com o espelho familiar `familias_auth`.

### RC2.7.13 — hotfix do Meu Piaget
- Criou `familias_auth/{sessionId}` e handshake familiar seguro.

### RC2.7.12 — Marco Zero por data + logo simples
- Introduziu corte em 10/08/2026 e reconstrução das contas.
