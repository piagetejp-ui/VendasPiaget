# CHANGELOG — RC2.7

## 1.6.0-rc2.7-meu-piaget-familias

### Meu Piaget e famílias

- Nova entrada `meu-piaget.html` para famílias.
- Entrada `equipe.html` para equipe interna; `index.html` permanece como entrada da equipe nesta candidata.
- Login familiar por CPF do responsável financeiro + senha.
- Primeiro acesso por CPF + matrícula de qualquer aluno vinculado.
- Senha familiar única nesta primeira fase.
- Recuperação assistida pela Secretaria com link temporário.
- Responsável financeiro separado dos dados do comprador do checkout.
- Seletor de aluno para famílias com irmãos.
- Notificações do Meu Piaget passam a considerar todos os alunos da família, sem misturar notificações de outras famílias.

### Conta financeira familiar

- Conta financeira canônica passa a ser `contas_responsaveis` após preparação da base.
- Saldo/crédito/dívida e autorização são compartilhados pelos irmãos.
- Limite máximo familiar = limite-base × quantidade de alunos ativos.
- Pedidos e movimentos continuam preservando `alunoId` de origem.
- Preparação da base consolida o saldo líquido das contas antigas dos alunos sem zerá-lo.
- Marco Zero é a única rotina que zera a conta familiar.

### Base oficial e ano letivo

- Base server-side construída a partir dos três relatórios SIGA de 07/08/2026.
- 214 alunos, 187 responsáveis financeiros e 214 vínculos.
- 24 responsáveis possuem mais de um aluno vinculado.
- Um cadastro com CPF incompleto é sinalizado para correção manual e bloqueia o Marco Zero até ser corrigido.
- CPFs válidos ficam armazenados na base server-side somente como hash SHA-256 e final mascarável, sem CPF completo no frontend.
- A antiga lista de alunos embutida em `01-core.js` foi removida; dados pessoais da base oficial não são enviados como cadastro estático no JavaScript público.
- Criada estrutura `matriculas_ano` para preservar histórico de enturmação por ano letivo.
- Alunos que não constam na fotografia oficial podem ser marcados como inativos, sem exclusão histórica.

### Implantação / Marco Zero

- Painel em Configurações para preparar a base oficial.
- Prévia do reset com contagem por coleção.
- Confirmação forte `INICIAR OPERAÇÃO REAL`.
- Backup interno antes da exclusão dos dados de teste.
- Reset operacional executável uma única vez por esse fluxo.
- Preservação de catálogo, preços, estoques atuais, configurações, usuários da equipe e base oficial.
- O reset nunca roda automaticamente no deploy.

### Links e pagamentos

- Links de venda online podem usar `PUBLIC_FAMILY_BASE_URL` para apontar ao domínio do Meu Piaget.
- Redirect da InfinitePay pode usar o domínio familiar.
- Webhook pode usar `PUBLIC_API_BASE_URL` independentemente do domínio familiar.
- Renovação de link online também respeita o endereço público familiar.
- Retorno de pagamento direciona para `meu-piaget.html`.

### Compatibilidade

- Núcleo `16-cash-responsibility.js` preservado funcionalmente em relação à RC2.6, alterando apenas o identificador de versão.
- Catálogo, fardamento por variação, Pedidos e demais mudanças da RC2.6 permanecem incorporados.
