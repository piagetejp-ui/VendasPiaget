# Validação técnica — V1.5.0 RC1.2

## Verificações automatizadas executadas

- sintaxe de todos os módulos JavaScript do frontend;
- sintaxe e carregamento dos handlers serverless;
- carregamento conjunto dos módulos na mesma ordem do `index.html`;
- presença das funções de diálogo, comprador, checkout, pedidos e programação;
- ausência de chamadas runtime a `alert()`, `confirm()` e `prompt()`;
- conferência de todos os caminhos locais de CSS, JavaScript e imagens;
- ausência de referências à pasta física da RC1.1;
- validação de URL HTTPS e de domínio autorizado para o checkout;
- chave da operação independente dos dados editáveis do comprador;
- substituição de checkout anterior da mesma operação;
- criação e persistência de checkout novo em Firestore simulado;
- remarcação com histórico da ocorrência anterior e criação da nova ocorrência;
- cancelamento com devolução do valor e estado final;
- transações simuladas respeitando a regra do Firestore: todas as leituras antes das gravações;
- integridade do arquivo ZIP.

## Resultado local

Os testes automatizados passaram no ambiente local controlado.

## Limites

Não foi possível confirmar localmente:

- a resposta real da InfinitePay para uma cobrança de produção;
- a disponibilidade e o conteúdo do link real retornado;
- regras, índices e dados atuais do Firestore de produção;
- comportamento final no Safari do iPhone.

Por isso, a versão deve ser validada na URL exclusiva do deploy antes de ser promovida para produção.
