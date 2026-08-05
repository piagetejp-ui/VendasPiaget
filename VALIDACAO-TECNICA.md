# Validação técnica — 1.6.0-rc2.4-caixa-responsabilidade

## Executado localmente

- verificação sintática de todos os arquivos JavaScript com Node.js;
- carregamento conjunto dos módulos frontend em contexto simulado;
- carregamento de todas as APIs com `firebase-admin` simulado;
- verificação de referências da versão e integridade do pacote;
- inspeção do vínculo `venda → sessão de caixa → período de responsabilidade`;
- inspeção da revalidação da sessão dentro da transação da venda;
- testes estáticos das permissões operador/gestor, aviso em Vendas, assunção, divergências, entradas e saídas;
- teste de integridade do ZIP.

## Necessita validação após deploy

- gravações reais no Firestore;
- concorrência entre fechamento, assunção e venda em dinheiro;
- permissões reais dos usuários autenticados;
- migração de eventual sessão de teste ainda aberta;
- comportamento em celulares usados pela Secretaria.

O deploy não foi realizado neste ambiente.
