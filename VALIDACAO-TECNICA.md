# Validação técnica — 1.6.0-rc2.3-lanches-pagamento-combinado

Validações locais executadas em 04/08/2026:

- sintaxe validada em **29 arquivos JavaScript**;
- carregamento conjunto dos **16 módulos frontend**;
- carregamento das **12 APIs** com Firebase Admin simulado;
- programação de lanche adicionada e devolvida ao carrinho misto;
- pagamento presencial combinado com dinheiro, Pix e cartão;
- cálculo de troco, valor líquido e taxa da maquininha;
- venda mista presencial com farda, mensalidade e lanche programado;
- uso parcial de saldo do aluno;
- operação totalmente coberta pelo saldo, sem pagamento externo;
- compatibilidade do fluxo anterior de programação de lanche;
- confirmação simulada de venda online mista após pagamento;
- criação simulada de pedido e ocorrência para a agenda da Cantina;
- atualização simulada da conta corrente do aluno;
- carregamento e integridade estrutural do pacote.

Durante a validação foram corrigidos também o reconhecimento do caixa aberto da Secretaria, o lançamento líquido de dinheiro após o troco e o vínculo das parcelas de pagamento aos movimentos e à venda.

A confirmação definitiva do webhook, da concorrência real de estoque e das transações financeiras depende do deploy com Firestore e InfinitePay de produção.
