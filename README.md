# Sistema de Vendas Escola Piaget — V1.5.0-dev5.2.1-financial-hotfix

Esta versão parte diretamente da **V1.5.0-dev5.2-logo-sharp**. Ela preserva a logo corrigida, a visualização mobile, o suporte ao iPhone e a estrutura visual já testada.

## Escopo desta revisão

A revisão é restrita ao financeiro:

- confirmação única para retorno do checkout, webhook e botão **Atualizar status**;
- consulta oficial do pagamento antes de qualquer lançamento;
- conferência do valor confirmado com o valor do checkout;
- leitura de todos os documentos do Firestore antes das gravações;
- movimentos financeiros com identificadores determinísticos;
- trava por `transaction_nsu`, impedindo que uma transação seja usada em dois pedidos;
- reutilização automática dos identificadores já armazenados;
- webhook bruto preservado antes do processamento;
- resposta `400` ao webhook quando o processamento falhar, permitindo reenvio;
- comprovante interno liberado somente após pagamento e pedido serem aplicados.

Não foi criada nova tela de conciliação.

## Recuperação silenciosa do pagamento do Armando

Ao abrir o sistema depois do deploy, o frontend chama silenciosamente `/api/sincronizar-financeiro`.

A rotina valida na InfinitePay:

- pedido: `PIAGET-FARDA-20260731-201148-3328`;
- transação: `9006c2e5-6ddf-45f7-b850-041bcd5110c8`;
- fatura: `YxSohBgR30`;
- valor externo esperado: R$ 23,00;
- total do pedido: R$ 42,00;
- matrícula: `220622`.

Somente depois da confirmação oficial o sistema aplica:

- entrada de R$ 23,00;
- compra de farda de R$ 42,00;
- consumo do crédito existente;
- confirmação do pedido;
- atualização do estoque ou envio para produção;
- geração do comprovante interno.

A migração é marcada como concluída e não executa novamente.

## Publicação

1. Suba o conteúdo do ZIP na Vercel.
2. Aguarde o deploy ficar `Ready`.
3. Abra o sistema uma vez.
4. Aguarde alguns segundos para a recuperação silenciosa.
5. Confira a conta e o pedido do Armando.

A aplicação real depende do Firestore e da InfinitePay de produção. Não faça um novo Pix para esse pedido.
