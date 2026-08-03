# Roteiro de testes — 1.5.0-dev5.2.2-pending-receipts

## 1. Descartar uma cobrança pendente
1. Gere um link sem concluir o pagamento.
2. Abra o portal do responsável > Pagamentos pendentes.
3. Toque em **Descartar cobrança** e confirme.
4. Confirme que a cobrança desapareceu da lista.
5. Na gestão, confirme que o registro continua no histórico com status `descartado_responsavel`.

## 2. Proteções
- Uma cobrança paga não deve permitir descarte.
- Uma cobrança com pagamento localizado/processando não deve permitir descarte.
- Repetir o descarte não deve gerar erro nem duplicar auditoria operacional relevante.

## 3. Pagamento tardio de cobrança descartada
1. Em ambiente de teste, descarte uma cobrança e depois pague o link antigo.
2. Confirme que o valor foi creditado na conta do aluno.
3. Confirme que o pedido antigo não foi recriado nem entregue automaticamente.
4. Confirme o alerta para gestão/secretaria.

## 4. Comprovante
1. Conclua um pagamento novo.
2. Na página de retorno, confirme apenas os botões **Voltar ao sistema**, **Atualizar pagamento** e **Comprovante**.
3. Abra **Comprovante** e teste:
   - Comprovante InfinitePay, quando houver URL;
   - Comprovante Piaget em imagem;
   - Imprimir/salvar Piaget em PDF.

## 5. Armando
- Após a primeira abertura, a cobrança histórica `PIAGET-FARDA-20260731-201148-3328` deve sair dos pendentes sem alterar o saldo do aluno.
