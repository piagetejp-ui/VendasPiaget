# Changelog — 1.5.0-dev5.2.3-operational-portal

## Portal do responsável

- Corrigida a transição **Montar pedido → Revisar pedido** por meio de um contrato público único do planejador.
- O pedido agora preserva dias, produtos e quantidades ao voltar da revisão.
- Totais atualizam imediatamente ao marcar dias ou alterar quantidades.
- Consulta de disponibilidade recebeu debounce e cache curto para reduzir leituras repetidas.
- Erros de revisão e checkout aparecem no próprio fluxo, sem botão silencioso.
- Validado o encaminhamento para checkout de crédito, fardamento e cantina.

## Interface operacional

- Textos longos e tutoriais permanentes foram reduzidos.
- Explicações secundárias passaram para o componente acessível **i**.
- Versão saiu do cabeçalho e passou a aparecer discretamente no menu interno.
- Portal e tela de vendas da secretaria ficaram mais compactos.

## Limpeza e segurança

- Removido checkout `teste_avulso`.
- Removido harness de auditoria da distribuição.
- Removida rotina específica do teste financeiro antigo.
- Removido fluxo legado de fardamento do responsável que chamava checkout antigo.
- Backend limita quantidades, valida canal do produto, tamanho e variação de farda.
