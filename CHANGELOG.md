# RC2.7.27 — Gestão da família, comprador padrão e autorização administrativa

Base de código: **RC2.7.26**.

## O que mudou

### 1. Cadastro oficial do responsável separado do comprador padrão
- A tela real de **Conta familiar → Resumo** agora expõe para Gestão/Secretaria os botões **Editar responsável** e **Editar comprador padrão**.
- **Editar responsável** altera somente o cadastro oficial da família e os espelhos de nome/telefone/e-mail dos alunos vinculados.
- A edição do responsável **não sobrescreve mais** `dados_pagamento_responsavel`.
- **Editar comprador padrão** altera nome, telefone e e-mail usados nos próximos pagamentos, sem modificar o cadastro oficial do responsável.
- A correção administrativa do comprador é propagada aos alunos vinculados à mesma família para preservar o comportamento atual, que ainda lê `dados_pagamento_responsavel` por aluno.
- Pagamentos, vendas e comprovantes antigos não são reescritos.
- As duas alterações geram auditoria, com antes/depois quando aplicável.

### 2. Autorização administrativa de consumo por aluno realmente funcional
- A tela real de **Conta familiar → Resumo** agora mostra **Autorização de consumo por aluno**.
- Gestão/Secretaria podem registrar uma condição pré-existente à implantação ou uma autorização administrativa individual.
- A compra da Cantina passa a consultar o documento atual do aluno dentro da transação, evitando usar uma autorização antiga mantida apenas no cache da tela.
- Quando existe regra administrativa individual, o limite efetivo passa a ser o `limiteConsumoCentavos` do aluno. Ele não depende mais de existir um limite familiar previamente configurado pelo responsável.
- Compras pagas integralmente com saldo continuam possíveis mesmo sem autorização para gerar saldo devedor.

### 3. Responsável assume o controle quando altera o Meu Piaget
- Ao salvar **Autorizações e limite** no Meu Piaget, o backend grava a regra familiar e encerra as regras administrativas individuais então existentes nos alunos vinculados.
- Os campos individuais `consumoCreditoAutorizado` e `limiteConsumoCentavos` são removidos e a origem atual passa a ser `responsavel`.
- A auditoria registra quais regras administrativas foram substituídas.
- Depois disso, a Cantina usa a autorização e o limite da conta familiar. A Gestão/Secretaria pode consultar a regra, mas não pode substituir a decisão atual do responsável por uma nova autorização administrativa.

## Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Rewrites da consolidação da Vercel Hobby preservados.
- Firestore Rules byte a byte iguais à RC2.7.26.
- Marco Zero e dados reais preservados.
- Núcleo InfinitePay/webhook não alterado.
- Fluxo de Cancelar / Estornar da RC2.7.26 preservado.
