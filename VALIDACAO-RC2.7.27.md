# Validação local/estática — RC2.7.27

Data: 11/08/2026
Base: **RC2.7.26**

## Escopo
Esta release consolida duas correções já definidas para a arquitetura familiar:
1. separar de fato **responsável financeiro oficial** e **comprador padrão dos próximos pagamentos**, expondo ambos à Gestão/Secretaria na tela real de Conta familiar;
2. tornar funcional a **autorização administrativa de consumo por aluno** e fazer a regra do responsável assumir o controle quando ele alterar a configuração no Meu Piaget.

## Resultado
**Aprovada em validação local/estática e mocks para deploy + smoke test real.**

### Estrutura e sintaxe
- 54 arquivos JavaScript verificados com `node --check`.
- 0 erros de sintaxe.
- 10 arquivos físicos em `/api` — permanece abaixo do limite de 12 funções observado no Vercel Hobby.
- 92 referências locais de HTML conferidas; 0 arquivos ausentes.
- 48 `require()` relativos conferidos; 0 módulos locais ausentes.
- 17 URLs `/api/...` usadas diretamente pelos JS/HTML ativos; todas resolvem para função física ou rewrite já existente.
- Release ativa referenciada pelos HTMLs/service worker: `1.6.0-rc2.7.27`.

### Firestore / infraestrutura preservada
- `firestore.rules` byte a byte igual à RC2.7.26.
- SHA-256 das Rules: `a38abddf0e715f771cea18b8fdf4f1af94d6d4e4d82686480b66c7232c14f11b`.
- Nenhuma nova função serverless criada.
- Consolidação `/api/familias`, `/api/operacoes` e respectivos rewrites preservada.
- Webhook/InfinitePay não alterado.
- Marco Zero não alterado.

### Responsável oficial x comprador padrão
Validação estrutural e mock confirmaram:
- a tela efetivamente usada pela Conta familiar contém **Editar responsável** e **Editar comprador padrão**;
- `editar_responsavel` não grava mais em `dados_pagamento_responsavel`;
- a edição oficial atualiza `responsaveis_financeiros` e os espelhos dos alunos vinculados;
- a edição oficial gera auditoria com `antes` e `depois`;
- a nova ação `editar_comprador_padrao` atualiza `dados_pagamento_responsavel` para os alunos da mesma família;
- a ação do comprador não altera `responsaveis_financeiros`;
- o mock preservou um comprador antigo após editar o responsável e preservou o responsável oficial após editar o comprador.

### Autorização administrativa / tomada de controle pelo responsável
Validação estrutural e mock confirmaram:
- a tela real de Conta familiar mostra a origem e a autorização por aluno;
- a Cantina relê o documento do aluno dentro da transação de compra (`tx.get(studentRef)`), reduzindo risco de autorização obsoleta em cache;
- regra individual administrativa usa diretamente `limiteConsumoCentavos`, sem depender de `limiteFiadoCentavos` familiar já existir;
- se não houver regra individual administrativa, a compra usa `autorizadoSemSaldo` e `limiteFiadoCentavos` da conta familiar;
- origem `responsavel` nunca é interpretada como override individual;
- ao responsável salvar a preferência familiar, o backend remove `consumoCreditoAutorizado` e `limiteConsumoCentavos` dos alunos vinculados e grava `origemAutorizacaoConsumo = responsavel`;
- depois que a origem passa a `responsavel`, a Gestão/Secretaria pode consultar a regra, mas o backend bloqueia uma nova substituição administrativa daquele aluno;
- o mock confirmou que uma regra administrativa pré-existente foi removida e registrada em `regrasAdministrativasSubstituidas`.

### Testes locais executados
- `node --check` em todos os 54 JS: aprovado.
- Validação estrutural de versão, referências locais, número de APIs e presença/ausência das regras antigas: aprovada.
- Mock de `handler-gestao-familias`: aprovado, incluindo separação responsável/comprador, autorização administrativa inicial e bloqueio de override depois que o responsável assume.
- Mock de `handler-security` para tomada de controle pelo responsável: aprovado.
- Firestore Rules comparadas por SHA-256 com a RC2.7.26: idênticas.

## Limites desta validação
Não foram executados:
- deploy real na Vercel;
- gravações contra o Firestore de produção;
- compra real na Cantina;
- login real de uma família e alteração de limite;
- checkout real na InfinitePay;
- validação visual em navegador/dispositivo real.

Esses itens pertencem ao smoke test pós-deploy.
