# Sistema de Vendas Escola Piaget — 1.5.0-rc1.5-venda-online-secretaria

Pacote completo para deploy. Esta versão acrescenta **Venda online** na página da Secretaria.

## Fluxo

1. A Secretaria seleciona o aluno e monta a operação.
2. O sistema gera um link da Escola Piaget com validade de 24 horas.
3. O responsável abre o link e confirma/preenche nome, telefone e e-mail.
4. Somente então o checkout da InfinitePay é criado.
5. O pagamento confirmado é aplicado à conta do aluno, à venda, ao estoque e ao fardamento/programação correspondente.

A venda presencial permanece disponível e inalterada.
