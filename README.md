# Sistema de Vendas Escola Piaget — V1.6.0 RC2

## Catálogo de vendas e motor unificado da Secretaria

Este é um pacote estrutural de desenvolvimento. Ele parte da RC1.5 e preserva o portal do responsável, a identidade visual, a responsividade mobile, a conta corrente do aluno e o checkout da InfinitePay já validados.

A principal mudança é a substituição da antiga tela **Produtos e estoque** por um **Catálogo de vendas** flexível, que passa a alimentar as vendas presenciais e online da Secretaria.

## Estrutura do catálogo

A Gestão e a Secretaria podem criar e editar:

- categorias principais;
- subcategorias em vários níveis;
- produtos, combos, fardamento, eventos, serviços, mensalidades, negociações e cobranças de valor livre;
- preço fixo ou editável;
- controle de estoque;
- ordem, situação ativa/inativa e canais de venda.

As categorias iniciais são apenas uma base:

- Cantina
  - Produtos
  - Combos
- Fardamento
- Eventos
- Serviços e cobranças
  - Mensalidades
  - Negociações

Novas categorias e subcategorias podem ser criadas sem alteração de código.

## Integração com os setores

- **Venda presencial:** consulta o Catálogo de vendas e registra pagamento, compra, estoque e conta do aluno.
- **Venda online:** usa o mesmo catálogo e gera um link vinculado ao aluno; o responsável informa os próprios dados antes da InfinitePay.
- **Portal do responsável:** produtos, combos e fardamento continuam usando o fluxo visual já validado. Alterações nesses itens são sincronizadas com os cadastros compatíveis do portal.
- **Cantina:** produtos e combos autorizados continuam disponíveis para a operação da cantina.

Itens como mensalidade, negociação, evento e serviço são ofertados pela Secretaria nesta RC2. A exposição genérica desses tipos diretamente no portal do responsável não foi adicionada para não alterar o portal já validado.

## Regras importantes

- Alterar nome ou preço vale para novas vendas.
- A venda salva uma fotografia do item, valor, quantidade, competência e referência utilizados.
- Inativar uma categoria retira seus itens das novas vendas.
- Combos podem consumir o estoque dos componentes.
- Eventos podem ter período de venda e limite de vagas.
- Mensalidades podem exigir competência.
- Negociações podem exigir referência ou descrição.
- Regularização de saldo e adição de crédito continuam como operações próprias, fora do catálogo.

## Migração inicial

Na primeira carga, o sistema cria o catálogo inicial usando os produtos, combos e modelos de fardamento atuais. A migração possui uma marca de conclusão para evitar duplicações.

Os registros de teste existentes não são apagados automaticamente.

## Publicação

1. Descompacte o ZIP.
2. Substitua o conteúdo do repositório pelo conteúdo do pacote.
3. Mantenha `index.html` na raiz.
4. Preserve as pastas `api`, `assets` e `releases`.
5. Aguarde o deploy da Vercel ficar `Ready`.
6. Faça os testes descritos em `TESTES.md`.

Arquivos essenciais na raiz:

```text
index.html
pagamento.html
obrigado.html
api/
assets/
releases/
sw.js
version.json
vercel.json
package.json
```
