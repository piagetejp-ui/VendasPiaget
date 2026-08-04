# Roteiro de testes — V1.6.0 RC2

## 1. Regressão protegida

1. Abrir o portal do responsável no computador e no celular.
2. Confirmar logo, cabeçalho, menu, saldo, extrato e notificações.
3. Fazer um pedido da cantina integralmente com saldo.
4. Fazer um pedido da cantina com checkout.
5. Fazer uma compra de fardamento pelo portal.
6. Conferir retorno e comprovantes.

## 2. Migração do catálogo

1. Entrar como Gestão ou Secretaria.
2. Abrir **Catálogo de vendas**.
3. Confirmar a existência das categorias Cantina, Fardamento, Eventos e Serviços e cobranças.
4. Confirmar que produtos, combos e fardamentos atuais foram importados uma única vez.
5. Recarregar o sistema e confirmar que não houve duplicação.

## 3. Categorias e subcategorias

1. Criar uma categoria principal chamada `Formatura`.
2. Criar a subcategoria `Fotografia` dentro dela.
3. Renomear a subcategoria.
4. Alterar sua ordem.
5. Mover a subcategoria para outra categoria.
6. Inativar a categoria e confirmar que seus itens somem das novas vendas.
7. Reativá-la e confirmar o retorno.
8. Repetir no celular e confirmar que editar categorias continua acessível.

## 4. Produtos da Cantina

1. Alterar o preço de um salgado no catálogo.
2. Confirmar o novo preço na venda presencial.
3. Confirmar o novo preço na venda online.
4. Quando liberado para o responsável, confirmar o novo preço no portal.
5. Alterar o nome e confirmar a atualização nos mesmos canais.
6. Configurar estoque geral e tentar vender acima da disponibilidade.

## 5. Combos

1. Criar um combo dentro da Cantina.
2. Adicionar dois componentes e suas quantidades.
3. Fazer uma venda presencial.
4. Confirmar a baixa dos componentes.
5. Tentar vender sem estoque suficiente de um componente.
6. Fazer uma venda online e repetir a validação após o pagamento.

## 6. Fardamento

1. Criar ou editar um item de fardamento.
2. Configurar tamanhos infantis e adultos.
3. Configurar preço infantil e adulto.
4. Fazer venda presencial e online.
5. Confirmar a criação do pedido de farda e a movimentação do aluno.
6. Confirmar que o portal mantém o layout e fluxo já validados.

## 7. Eventos

1. Criar um evento com data, período de vendas e limite de vagas.
2. Confirmar que aparece nas vendas durante o período configurado.
3. Confirmar que não aparece fora do período.
4. Fazer venda presencial e online.
5. Tentar ultrapassar o limite de vagas.

## 8. Mensalidade e negociação

1. Selecionar Mensalidade.
2. Informar competência e valor.
3. Confirmar que não avança sem competência.
4. Conferir a competência no carrinho, venda e extrato.
5. Selecionar Negociação.
6. Informar referência e valor.
7. Confirmar que não avança sem referência.

## 9. Regularização e crédito

1. Selecionar aluno com saldo negativo.
2. Fazer regularização presencial e confirmar saldo zerado.
3. Gerar link online de regularização e concluir o pagamento.
4. Adicionar crédito presencialmente.
5. Gerar link online de adição de crédito.
6. Confirmar os subtipos corretos no extrato.

## 10. Dados do comprador e checkout online

Usar como teste:

```text
Nome: Daniele Faustina de Sousa Matos Aguiar
Telefone: 86999883823
E-mail: lucasgomesviana.ejp@gmail.com
```

1. Gerar venda online pelo catálogo.
2. Abrir o link público.
3. Confirmar que os dados são aceitos.
4. Chegar à InfinitePay.
5. Pagar e conferir venda, estoque, conta do aluno e comprovante.

## 11. Inativação e mudança de tipo

1. Inativar um produto que aparece no portal.
2. Confirmar que ele deixa de aparecer em novas compras.
3. Alterar um produto para serviço.
4. Confirmar que o cadastro antigo de produto é retirado dos canais anteriores.
5. Confirmar que vendas antigas continuam legíveis.
