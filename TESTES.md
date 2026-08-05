# Roteiro de testes — 1.6.0-rc2.4-caixa-responsabilidade

## 1. Abertura sem turno

1. Entrar como Daniele.
2. Abrir **Caixa** e informar o valor contado.
3. Confirmar que aparecem horário, responsável e saldo esperado, sem seleção de manhã/tarde.
4. Abrir **Vendas** e confirmar o aviso “Caixa aberto e sob sua responsabilidade”.

## 2. Venda em dinheiro

1. Com o caixa aberto por Daniele, registrar venda presencial com dinheiro.
2. Confirmar que a venda é concluída.
3. Voltar ao caixa e conferir a entrada líquida, descontado eventual troco.
4. Verificar que Pix e cartão não alteram o dinheiro físico.

## 3. Aviso antecipado

1. Fechar o caixa.
2. Abrir **Vendas**.
3. Confirmar o aviso de caixa fechado antes de iniciar a venda.
4. Confirmar que Pix, cartão e saldo permanecem disponíveis.
5. Tentar adicionar dinheiro e confirmar que o sistema oferece a abertura sem perder a venda.

## 4. Troca Daniele → Evanda sem fechamento

1. Deixar o caixa aberto como Daniele.
2. Entrar como Evanda.
3. Confirmar o aviso de caixa sob responsabilidade de Daniele.
4. Usar **Conferir e assumir**.
5. Informar exatamente o saldo esperado.
6. Confirmar que Evanda assume e pode vender em dinheiro sem pendência financeira.

## 5. Troca com divergência

1. Repetir a troca, informando valor contado diferente do esperado.
2. Confirmar que Evanda assume pelo valor efetivamente contado.
3. Confirmar que a venda em dinheiro continua liberada para Evanda.
4. Verificar que a divergência fica na conta de Daniele e aguarda decisão gerencial.

## 6. Hierarquia

1. Fechar caixa com divergência como operadora e informar justificativa.
2. Confirmar que a situação fica “Aguardando decisão gerencial”.
3. Entrar como Lucas e abrir **Caixa**.
4. Aprovar, rejeitar/pedir esclarecimento, manter pendente ou regularizar.
5. Abrir/fechar um caixa como Lucas com divergência e confirmar que sua justificativa nasce como decisão gerencial definitiva.

## 7. Entradas e saídas

1. Registrar entrada manual.
2. Registrar saída por suprimento.
3. Registrar pagamento a funcionário.
4. Confirmar descrição, usuário, horário e efeito no saldo esperado.
5. Fechar o caixa e conferir a memória de movimentações.

## 8. Conta mensal de divergências

1. Criar divergências para mais de um operador.
2. Conferir a visão mensal individual da operadora.
3. Conferir, como Lucas, totais por operador e pendências para decisão.
4. Confirmar que sobras não compensam desfalques automaticamente.

## 9. Permissões e implantação

1. Em **Usuários e acessos**, criar um usuário sem acesso ao caixa e outro como operador.
2. Confirmar os limites de cada perfil.
3. Confirmar que o antigo aviso/cartão/modo de implantação não aparece mais no login ou em Usuários e acessos.

## 10. Regressão

Revalidar portal do responsável, checkout InfinitePay, carrinho misto, programação de lanches com múltiplos produtos, venda online e cartão com líquido/bruto.
