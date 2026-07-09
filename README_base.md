# Vendas Piaget — V1.1.0

Esta versão evolui a V1.0.2 preservando o Firestore existente.

## Principais alterações

- Nova página **Vendas da Secretaria** com operação composta:
  - aluno opcional;
  - produtos cadastrados;
  - débito em aberto;
  - camisa de farda;
  - itens avulsos classificados;
  - pagamento em dinheiro, Pix e cartão;
  - pagamentos divididos;
  - registro do bruto da maquininha, adquirente, modalidade e parcelas;
  - troco no dinheiro e impacto correto no caixa.
- Novas coleções geradas sob demanda: `itens_venda` e `pagamentos_venda`.
- KPIs clicáveis com drill-down para vendas, alunos devedores, contas bloqueadas e fardas pendentes.
- Histórico de vendas investigável, com composição completa por operação.
- Novo motor de documentos:
  - PDF A4 vetorial/multipágina para conta do aluno;
  - imagem específica para WhatsApp;
  - comprovante PDF da venda;
  - relatório PDF de fechamento de caixa.
- KPIs do caixa clicáveis com memória de cálculo.
- Migração não destrutiva: nenhuma reinicialização da base é necessária.

## Atualização

Substitua o `index.html` da versão anterior e faça um novo deploy. Não apague o Firestore e não importe os alunos novamente.

## Observação de segurança

O acesso continua provisório e sem Firebase Authentication nesta fase de desenvolvimento.
