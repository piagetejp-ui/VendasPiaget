# Sistema de Vendas Escola Piaget — V1.5.0 RC1.2

Candidata de correção do Portal do Responsável, construída sobre a RC1.1.

## Escopo desta revisão

- etapa única **Dados do comprador** antes de qualquer pagamento externo;
- pedido integralmente pago pelo saldo confirmado sem abrir a InfinitePay;
- nova tentativa de pagamento gera um link novo e substitui cobranças antigas da mesma operação;
- validação do endereço devolvido pela InfinitePay antes do redirecionamento;
- cancelamento de entrega futura com devolução do valor e encerramento visual da ocorrência;
- remarcação preservando a ocorrência antiga como histórico e criando uma nova entrega;
- substituição de `alert`, `confirm` e `prompt` por diálogos com o layout do sistema.

## Publicação

1. Envie todo o conteúdo do pacote para o projeto na Vercel.
2. Aguarde o deploy ficar como **Ready**.
3. Abra a URL exclusiva do deploy.
4. Execute o roteiro de `TESTES.md` antes de promover para produção.

A validação local não substitui testes reais com Firestore, InfinitePay e iPhone.
