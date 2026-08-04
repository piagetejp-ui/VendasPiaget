# Roteiro de testes — RC1.1

## 1. Carregamento

1. Aguarde o deploy ficar `Ready`.
2. Abra a URL exclusiva do deploy.
3. Confirme que login, portal e menu carregam sem erro.

## 2. Pedido pago integralmente com saldo

1. Use aluno com crédito suficiente.
2. Monte pedido da cantina.
3. Ative **Usar saldo**.
4. Confirme que o valor externo é R$ 0,00 e o botão diz **Confirmar pedido**.
5. Confirme.
6. Verifique pedido confirmado, saldo reduzido, entrega criada e ausência de cobrança pendente.

## 3. Pedido sem usar saldo

1. Use aluno com crédito positivo.
2. Desative **Usar saldo**.
3. Confirme que o checkout é gerado pelo valor integral.

## 4. Saldo parcial

1. Use aluno com crédito menor que o pedido.
2. Ative **Usar saldo**.
3. Confirme que o checkout é gerado apenas pela diferença.

## 5. Programação

1. Abra uma programação ativa.
2. Remarque uma entrega futura para outro dia útil com estoque.
3. Cancele outra entrega futura.
4. Confirme crédito na conta, liberação do estoque e status encerrado.
5. Repita com uma programação antiga, se houver.

## 6. Extrato

1. Confira que o saldo mantém o visual original.
2. Clique somente em **Ver extrato**.
3. Confirme que o extrato abre.

## 7. Cobranças pendentes

1. Descarte uma cobrança não paga.
2. Confirme que ela some da lista ativa e não reaparece ao atualizar.
