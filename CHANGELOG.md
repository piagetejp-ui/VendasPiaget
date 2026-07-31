# Changelog — V1.5.0-dev2

## Portal do responsável

- Reformulada a página inicial em formato de central compacta.
- Adicionados menus para Conta, Cantina, Fardamento, Pedidos, Movimentações, Dados do comprador e Autorizações.
- Movidos dados secundários para modais.
- Adicionado detalhamento do pedido principal com entregas diárias.
- Adicionados status humanizados e devoluções por data.
- Removidos códigos com underline da apresentação ao responsável.

## Fardamento

- Adicionada compra de fardamento no portal.
- Adicionado checkout parcial após uso do saldo positivo.
- Adicionada confirmação de pedido usando somente saldo.
- Adicionada reserva de estoque quando a variação está disponível.
- Adicionado encaminhamento para produção quando não há estoque configurado ou suficiente.
- Adicionadas notificações para secretaria, gestão e administração.

## InfinitePay

- Unificado o preenchimento do comprador em todos os tipos de checkout.
- Adicionada busca automática dos dados salvos do comprador.
- Mantido fallback para responsável financeiro e telefone do cadastro do aluno.
- Incluído e-mail nos pedidos de cantina e fardamento.

## Secretaria

- Criado botão destacado `+ Nova venda`.
- Criado fluxo em quatro etapas.
- Adicionada consulta do saldo e limite antes da venda.
- Adicionada venda imediata de cantina.
- Adicionada venda de fardamento.
- Adicionada programação presencial de lanches.
- Adicionada entrada de crédito.
- Adicionado uso opcional do crédito existente.
- Adicionado cálculo de pagamento mínimo e saldo final.
- Adicionada escolha entre troco entregue e troco como crédito.
- Adicionado registro de entrada e saída na conta corrente para operações de soma zero.
- Adicionado endpoint `/api/registrar-operacao-presencial`.
- Pagamento em dinheiro exige caixa aberto.

## Catálogo e configurações

- Separado catálogo em Cantina, Fardas / Fábrica, Combos e Inativos.
- Adicionada edição de canais de venda dos produtos.
- Adicionada edição de preços e disponibilidade dos modelos de farda.
- Reorganizadas configurações por área.
- Fixada reserva temporária da cantina em cinco minutos.

## Mobile

- Removida barra de navegação horizontal inferior.
- Adicionado menu lateral pelo cabeçalho.
- Adicionado overlay e fechamento automático após navegação.
- Modais passam a ocupar a tela inteira no celular.
- Adicionado espaçamento para a área segura inferior do aparelho.

## Desempenho e retorno do checkout

- Removidas gravações atrasadas de versão herdadas de versões anteriores.
- Consolidadas chamadas de identidade visual.
- Pedidos, extrato e comprador passam a carregar sob demanda.
- Adicionado timeout de oito segundos à consulta em `obrigado.html`.
- Melhorada mensagem quando o webhook continuará processando em segundo plano.

## Backend

- Adicionado tipo `pedido_farda`.
- Adicionada aplicação transacional de pagamento e compra de farda.
- Adicionada operação presencial transacional.
- Adicionado registro de caixa para recebimento e troco.
- Adicionada programação de cantina presencial com obrigações diárias.
- Atualizados registros de auditoria para `1.5.0-dev2`.
