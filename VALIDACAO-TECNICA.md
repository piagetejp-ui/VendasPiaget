# Validação técnica — V1.5.0 RC1.1

## Problema-raiz corrigido

A RC1 exportava `discardCheckout` em `api/_utils.js`, mas a função não existia. O Node falhava ao carregar o módulo compartilhado e, por consequência, os endpoints serverless não iniciavam.

## Verificações executadas

- sintaxe de todos os arquivos JavaScript com `node --check`;
- carregamento real de `_utils.js` e de todos os sete handlers de API com substituto controlado do Firebase Admin;
- confirmação de pedido da cantina integralmente pago pelo saldo, sem chamada à InfinitePay;
- geração de checkout pelo valor integral quando o saldo é preservado;
- geração de checkout apenas pela diferença quando o saldo é usado parcialmente;
- repetição da confirmação com saldo sem duplicar movimentações;
- cancelamento de programação antiga sem `valorCentavos` gravado diretamente;
- remarcação de entrega futura, com liberação da data anterior e reserva da nova;
- descarte de cobrança pendente e invalidação da tentativa associada;
- teste de transação simulando a regra do Firestore que proíbe leituras após a primeira gravação;
- carregamento conjunto dos módulos do planejador e da revisão do pedido;
- conferência dos caminhos locais de scripts, CSS e imagens;
- ausência de referências à pasta física da RC1 anterior;
- integridade do arquivo ZIP.

## Resultado local

Todos os testes automatizados acima passaram.

## Limites da validação

A validação real ainda depende do deploy na Vercel, do Firestore de produção, da disponibilidade real cadastrada e da resposta efetiva da InfinitePay. O pacote não foi publicado por esta validação.
