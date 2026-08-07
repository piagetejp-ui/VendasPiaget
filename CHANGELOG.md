# Changelog — 1.6.0-rc2.6-pedidos-fardamento

## Fardamento e produção

- Removido o preço geral do produto-pai **Camisa de farda**.
- Preço passa a ser armazenado e usado por variação/tamanho.
- Adicionada edição em lote de preços para variações selecionadas.
- Catálogo exibe **Preço por tamanho** em vez de `R$ 0,00` no produto-pai.
- Mantidos os grupos Infantil/Juvenil, Feminino/Baby Look e Masculino.
- Estoque por variação passa a apresentar físico, reservado, disponível, em produção e comprometido.
- Compra sem estoque deixa de ser bloqueada e pode gerar necessidade de produção.
- Reposição adicionada em lotes mínimos de 5 quando a produção livre não cobre a nova demanda.
- Pedidos pagos aguardando produção ficam comprometidos com o aluno.
- No recebimento da produção, compromissos mais antigos são reservados primeiro; somente o restante fica livre.
- Cancelamento de pedido parcialmente reservado/parcialmente em produção libera somente a reserva e o compromisso daquele aluno; o lote já encomendado ao fornecedor permanece como produção livre.
- Portal do responsável e vendas presencial/online utilizam a mesma fonte de preço e estoque da variação.

## Pedidos unificados

- `Pedidos` passa a reunir Cantina, Fardamento, Eventos, Serviços e cobranças, Mensalidades e Negociações.
- O antigo acesso operacional `Fardas` deixa de aparecer no menu e redireciona para `Pedidos → Fardamento` por compatibilidade.
- Pedido de fardamento deixa de nascer pelo fluxo manual da tela de Fardas; a operação visível passa a nascer de venda/compra.
- Status de pagamento e status de atendimento são apresentados separadamente.
- Eventos e serviços vendidos passam a gerar registros operacionais próprios para acompanhamento.
- Secretaria, Gestão e Cantina podem abrir o pedido e navegar por aluno/contexto conforme suas permissões.

## Cantina e responsável

- Secretaria recebe ações operacionais de entrega, ausência e não entrega/estorno nos pedidos de Cantina.
- A autoria da ação é preservada em movimentações e auditoria.
- Atualizações de Cantina, Fardamento e demais pedidos notificam o responsável quando pertinentes.
- Portal do responsável passa a incluir pedidos operacionais além de Cantina e Fardamento.

## Notificações, busca e navegação

- Notificações recuperam/exibem turma do aluno quando disponível.
- Distribuição continua separada por perfil e por aluno destinatário.
- Cards de Notificações e Pedidos funcionam como filtros.
- Cards principais de Resumo, Cobranças e Gestão do Caixa foram transformados em atalhos/filtros quando representam dados navegáveis.
- Busca do catálogo da venda deixa de reconstruir o campo a cada tecla; a filtragem ocorre mantendo foco e cursor.
- Pedidos, Notificações e Auditoria usam filtragem local durante a digitação.
- Links de alunos nos pedidos abrem a visão administrativa correspondente.

## Interface e compatibilidade

- Removidos textos de interface como “Detalhes técnicos” e referências de autenticação ao provedor na navegação exibida ao usuário.
- Permissões são apresentadas com nomes amigáveis de áreas, não com chaves internas.
- Registros históricos/migração continuam preservados internamente, com rótulos amigáveis na interface.
- O núcleo do caixa físico (`16-cash-responsibility.js`) foi preservado funcionalmente em relação à RC2.5.1, mudando apenas a identificação da release.
