# Roteiro de testes — 1.5.0-dev5.2.3-operational-portal

## Portal do responsável

1. Entrar no aluno e confirmar que os nove atalhos abrem.
2. Abrir Pedido da cantina e testar **Um dia**, **Semana** e **Mês**.
3. Marcar e desmarcar dias; conferir atualização imediata do total.
4. Alterar produto e quantidade; conferir total e disponibilidade.
5. Tocar em **Revisar pedido** e confirmar avanço.
6. Tocar em **Voltar e alterar** e confirmar que as escolhas permanecem.
7. Revisar com uso do saldo desligado e ligado.
8. Confirmar pedido pago totalmente pelo saldo e pedido direcionado à InfinitePay.
9. Testar Adicionar crédito e Comprar fardamento até a criação do checkout.
10. Abrir Pagamentos pendentes, atualizar status e descartar uma cobrança não paga.

## Ajuda e mobile

1. Tocar nos ícones **i** e confirmar abertura/fechamento do balão.
2. Testar em iPhone/Android com teclado aberto e modal do planejador.
3. Confirmar que a versão não ocupa o cabeçalho e aparece no rodapé do menu interno.

## Secretaria

1. Abrir **Vendas** e confirmar que **Nova venda** abre o assistente.
2. Testar venda imediata, programação de lanches e adição de crédito.
3. Em **Usuários e acessos**, alterar o filtro de solicitações de redefinição e confirmar atualização.

## Backend

1. Requisição com quantidade 11 deve ser recusada.
2. Produto com `vendaResponsavel=false` deve ser recusado no portal.
3. Tamanho ou variação inexistente de farda deve ser recusado.
4. Confirmar que `teste_avulso` retorna tipo não suportado.
