# Auditoria estrutural — Catálogo de vendas

## Fonte única de configuração

A coleção `catalogo_categorias` organiza a árvore de categorias e subcategorias. A coleção `catalogo_itens` concentra preço, tipo operacional, estoque, canais e regras.

## Compatibilidade protegida

O portal do responsável permanece usando seus fluxos validados. Produtos, combos e fardamento do novo catálogo são sincronizados com os cadastros compatíveis usados pelo portal. Isso permite alterar nome, preço e disponibilidade sem reescrever a experiência aprovada.

## Vendas

A Secretaria passa a usar um único carrinho para venda presencial e online. O canal altera a forma de recebimento, mas não altera o produto, valor, aluno ou regras operacionais.

## Tipos operacionais

A categoria serve para organização. O tipo operacional determina o comportamento:

- produto e combo: preço, quantidade e possível estoque;
- fardamento: tamanho, modelo e pedido de produção;
- evento: data, período e capacidade;
- mensalidade: competência;
- negociação: referência;
- serviço e valor livre: sem estoque, com preço fixo ou informado.

## Histórico

Cada venda salva os dados utilizados naquele momento. Alterações futuras no catálogo não reescrevem os itens já gravados em vendas, movimentos e pedidos.

## Migração

O catálogo inicial é criado a partir dos cadastros atuais. Como o sistema ainda está em desenvolvimento, não foi criada uma camada extensa de compatibilidade para todos os registros de teste antigos. O foco foi preservar as operações e interfaces já validadas.
