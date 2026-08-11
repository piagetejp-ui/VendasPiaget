# Validação local/estática — RC2.7.28

Data: 11/08/2026  
Base: **RC2.7.27**

## Escopo
A RC2.7.28 corrige três regressões reproduzidas no uso real:
1. venda presencial de fardamento falhando com `nome is not defined`;
2. Cancelar / Estornar falhando no navegador com `detalhes is not defined`;
3. Meu Piaget falhando em movimentações, notificações e outras telas com `Missing or insufficient permissions` por consultas diretas ao Firestore que não eram comprováveis pelas Rules para todos os formatos de histórico familiar.

## Resultado
**Aprovada em validação local/estática e testes de execução isolados para deploy + smoke test real.**

### Estrutura e sintaxe
- 55 arquivos JavaScript verificados com `node --check`.
- 0 erros de sintaxe.
- 10 arquivos físicos em `/api` — permanece abaixo do limite de 12 funções observado no Vercel Hobby.
- 92 referências locais de HTML conferidas; 0 arquivos ausentes.
- 51 `require()` relativos conferidos; 0 módulos locais ausentes.
- 17 URLs `/api/...` usadas pelos HTML/JS ativos; todas resolvem para função física ou rewrite.
- Release ativa referenciada pelos HTMLs: `1.6.0-rc2.7.28`.

### Firestore / infraestrutura preservada
- `firestore.rules` byte a byte igual à RC2.7.27.
- SHA-256 das Rules: `a38abddf0e715f771cea18b8fdf4f1af94d6d4e4d82686480b66c7232c14f11b`.
- Nenhuma nova função física em `/api`; `handler-family-data.js` é carregado pela função existente `/api/familias`.
- Nenhuma abertura de permissão foi feita para corrigir o Meu Piaget.
- Webhook/InfinitePay não alterado.
- Marco Zero não alterado.

## 1. Venda presencial de farda
### Causa confirmada
`addUniformStockRequirement()` recebia o parâmetro `name`, mas o objeto de requisito tentava usar a variável inexistente `nome`.

### Correção
O requisito passa a gravar explicitamente `nome: name`.

### Teste de execução
Foi executado `normalizeSecretarySaleItems()` com banco simulado para:
- camisa de farda;
- tamanho 10;
- 1 unidade;
- estoque configurado e disponível;
- preço R$ 47,00.

Resultado:
- total: 4.700 centavos;
- requisito de estoque preservou `nome = Camisa de farda`;
- status da linha: `reservado_estoque`;
- nenhuma exceção `nome is not defined`.

## 2. Cancelamento / estorno
### Causa confirmada
A tela criava `const details = ...`, mas enviava `detalhes` como shorthand no `JSON.stringify`, gerando `ReferenceError` antes da chamada ao backend.

### Correção
O payload agora usa `detalhes: details`.

### Preservado
- motivo obrigatório;
- distinção entre valor não recebido e reembolso efetivo;
- correção explícita de entrega marcada como entregue por engano;
- auditoria e reversões transacionais já existentes.

## 3. Meu Piaget — camada de dados familiar
### Problema
O navegador do responsável consultava diretamente coleções operacionais por diferentes campos (`responsavelFinanceiroId`, `responsavelId`, `alunoId`, `alunosIds`, destinatários etc.). Como Firestore Rules não funcionam como filtro de resultados, uma consulta que não prova previamente a propriedade de todos os documentos pode receber `permission-denied`, mesmo quando os documentos desejados pertencem à família.

### Correção arquitetural
Foi criado `server/handler-family-data.js`, roteado por `/api/familias?modulo=dados`.

O backend:
- valida a sessão familiar do cookie HttpOnly;
- deriva o `responsavelId` da sessão;
- consulta no servidor os alunos vinculados ao responsável;
- consulta apenas coleções permitidas para o portal;
- faz deduplicação e pós-validação de propriedade familiar;
- devolve JSON seguro ao navegador.

Fluxos do responsável migrados para a camada segura:
- movimentações/extrato e paginação;
- histórico familiar usado por pedidos e pagamentos;
- avisos da tela inicial;
- pagamentos pendentes, inclusive a checagem preventiva antes de uma nova cobrança;
- programação de lanches;
- listagem de notificações;
- detalhe de notificação;
- marcar como lida;
- marcar todas como lidas.

A equipe continua nos caminhos existentes de Firestore; a rota segura é acionada somente no modo responsável.

### Teste mock do backend familiar
A camada foi executada com banco simulado contendo dois alunos da família e registros de outra família. Foram aprovados:
- propriedade familiar em `query_records`;
- paginação de `history`;
- exclusão de registros de outra família;
- listagem de notificações somente da família;
- bloqueio HTTP 403 ao tentar abrir notificação de outra família;
- marcação de leitura com ator `responsavel:<responsavelId>`;
- programação de lanches somente da família;
- bloqueio de coleção não autorizada.

## Limites desta validação
Não foram executados:
- deploy real na Vercel;
- leitura contra o Firestore de produção pela nova rota;
- navegador real com sessão do responsável;
- venda presencial real de farda;
- cancelamento real de venda;
- checkout real na InfinitePay.

Esses itens pertencem ao smoke test pós-deploy.
