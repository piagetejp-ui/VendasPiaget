# Changelog — 1.6.0-rc2.4-caixa-responsabilidade

## Caixa da Secretaria

- Removida a dependência de turno para o caixa físico da Secretaria.
- `sessoes_caixa` passa a ser a fonte das novas vendas em dinheiro.
- Criados períodos em `periodos_responsabilidade_caixa`.
- Criada conferência para assumir um caixa aberto por outro operador.
- Divergências da troca ficam vinculadas ao período anterior e não bloqueiam o novo responsável.
- Criadas entradas e saídas manuais com categoria, descrição, beneficiário e referência de comprovante.
- Vendas e pagamentos em dinheiro passam a registrar sessão e período de responsabilidade.

## Hierarquia e auditoria

- Adicionada permissão de caixa: sem acesso, operador ou gestor.
- Lucas inicia como gestor; Daniele e Evanda como operadoras.
- Operadores registram justificativas, mas a decisão final pertence à Gestão.
- Divergência registrada por gestor é concluída como decisão gerencial, mantendo o histórico.
- Criada conta mensal informativa de divergências por operador.

## Experiência de uso

- A página Vendas informa antecipadamente se o caixa está fechado, disponível ou sob responsabilidade de outra pessoa.
- Pix, cartão e saldo continuam disponíveis quando o caixa físico está fechado.
- Removidos cartões, aviso e funções visíveis do antigo modo de implantação.
