# Escola Piaget — Sistema de Vendas V1.5.0-dev2

Base utilizada: **V1.5.0-dev1**, que por sua vez preserva a V1.4.3 validada para login do responsável, conta corrente do aluno e Checkout InfinitePay.

Esta entrega é uma versão de desenvolvimento para **deploy de preview**. Não substitua a produção antes de concluir o checklist de testes.

## Principais alterações

### Portal do responsável

A página inicial foi reorganizada como uma central compacta, com acessos separados para:

- adicionar crédito ou regularizar saldo;
- fazer pedido da cantina;
- comprar fardamento;
- acompanhar pedidos;
- consultar movimentações;
- editar dados do comprador;
- definir autorização e limite.

As informações secundárias passaram para modais, evitando uma página excessivamente longa.

### Pedido principal e entregas diárias

Pedidos avulsos, semanais e mensais aparecem como um pedido principal. O detalhamento mostra cada data gerada e sua situação:

- pendente de entrega;
- entregue;
- aluno ausente;
- não entregue;
- valor devolvido para a conta.

O resumo calcula quantas entregas foram finalizadas e informa quando o pedido foi concluído com devoluções.

### Fardamento no portal

Foi incluído o fluxo de compra de fardamento pelo responsável:

- modelo;
- tamanho;
- variação masculina, feminina ou modelo único;
- quantidade;
- uso do saldo positivo;
- Checkout InfinitePay apenas para o valor necessário;
- acompanhamento do atendimento pela secretaria.

Quando existe estoque configurado e disponível, o pedido confirmado fica reservado em estoque. Caso contrário, segue como aguardando produção.

### Dados do comprador e InfinitePay

Todos os checkouts passam a combinar:

1. dados informados na operação;
2. dados do comprador salvos no perfil;
3. dados básicos do responsável no cadastro do aluno.

Nome, telefone e e-mail são normalizados antes de montar o campo `customer` enviado à InfinitePay.

A confirmação real desses três campos na tela da InfinitePay depende de um teste no ambiente de preview, pois não foi realizado pagamento externo nesta geração.

### Secretaria

A área de vendas agora abre com o botão **+ Nova venda** e utiliza um modal em etapas:

1. aluno;
2. tipo de operação e itens;
3. pagamento;
4. confirmação.

Operações disponíveis:

- venda imediata de cantina;
- venda de fardamento;
- programação de lanches por dia, semana ou mês;
- adição de crédito.

A tela mostra saldo, limite e situação da conta antes da venda. Compras pagas externamente passam pela conta como entrada e saída, mantendo o saldo anterior quando a operação é soma zero.

Em pagamentos com valor maior que a compra, a secretaria escolhe:

- devolver o troco;
- deixar a diferença como crédito na conta.

Pagamentos em dinheiro exigem caixa da secretaria aberto.

### Produtos e configurações

A gestão de produtos foi dividida em:

- Cantina;
- Fardas / Fábrica;
- Combos;
- Inativos.

Produtos da cantina permitem configurar canais de venda. Modelos de farda permitem editar preços, status e disponibilidade no portal.

As configurações foram reorganizadas em Cantina, Conta Corrente, Fardamento e Checkout.

### Mobile

A barra horizontal inferior foi removida no layout móvel. O menu interno passou a abrir lateralmente pelo botão no cabeçalho, sem disputar espaço com a barra de gestos do celular.

Modais usam a tela inteira no celular e respeitam a área segura inferior.

### Carregamento

Foram removidas várias gravações de versão e inicializações atrasadas herdadas das camadas anteriores. As consultas de pedidos, extrato e dados do comprador agora ocorrem apenas quando o usuário abre a respectiva área.

A página `obrigado.html` encerra a consulta após 8 segundos e informa que o webhook continuará processando a confirmação, evitando loading indefinido.

## Arquivos do pacote

```text
index.html
obrigado.html
package.json
api/_utils.js
api/criar-checkout.js
api/verificar-pagamento.js
api/webhook-infinitepay.js
api/registrar-operacao-presencial.js
README.md
CHANGELOG.md
```

A pasta `assets/` não está incluída. Ao aplicar o pacote, mantenha a pasta `assets/` da versão já implantada.

## Endpoint novo

```text
POST /api/registrar-operacao-presencial
```

Responsável por registrar operações da secretaria com conta corrente, pagamento, troco, caixa, estoque e pedidos vinculados.

## Checklist de preview

### Portal

1. Entrar como responsável.
2. Confirmar a nova página compacta.
3. Salvar nome, telefone e e-mail em Dados do comprador.
4. Adicionar crédito pela InfinitePay.
5. Programar lanches de uma semana.
6. Abrir Meus pedidos e consultar cada dia.
7. Comprar fardamento.
8. Testar todos os modais no celular.

### InfinitePay

1. Verificar se nome, telefone e e-mail aparecem no checkout.
2. Concluir um pedido da cantina.
3. Concluir um pedido de fardamento.
4. Conferir retorno em `obrigado.html`.
5. Confirmar saldo, pedido e comprovante após webhook.

### Secretaria

1. Abrir o caixa da secretaria.
2. Fazer venda de R$ 9,00 recebendo R$ 9,00.
3. Fazer venda de R$ 9,00 recebendo R$ 10,00 e devolver R$ 1,00.
4. Repetir deixando R$ 1,00 como crédito.
5. Fazer uma venda sem usar o crédito já existente.
6. Fazer uma venda usando o crédito existente e pagar a diferença.
7. Programar lanches semanais com pagamento presencial.
8. Comprar uma farda e conferir a fila da secretaria.

### Cantina

1. Conferir a agenda de uma data futura.
2. Marcar uma entrega como entregue.
3. Marcar outra como aluno ausente.
4. Conferir devolução para a conta e liberação do salgado.
5. Consultar pendências de dias anteriores.

## Validações realizadas na geração

- sintaxe de todos os scripts internos do `index.html`;
- sintaxe de `obrigado.html`;
- sintaxe das cinco APIs Node.js;
- teste em memória de pedido de cantina com saldo negativo;
- teste em memória de envio combinado dos dados salvos do comprador;
- teste em memória de pedido de fardamento pago com saldo;
- teste em memória de reserva de farda em estoque;
- teste em memória de venda presencial em soma zero;
- teste em memória de troco devolvido;
- teste em memória de troco convertido em crédito;
- teste em memória de programação presencial gerando obrigações diárias.

Não foram realizados deploy na Vercel, autenticação real, leitura real do Firestore ou pagamento real na InfinitePay.
