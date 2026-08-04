# Validação técnica — 1.6.0-rc2.3.1-cartao-liquido-bruto-hotfix

Validações locais executadas:

- sintaxe de todos os arquivos JavaScript;
- carregamento conjunto dos módulos frontend;
- carregamento de todas as APIs com Firebase Admin simulado;
- cartão com líquido de R$ 61,00 e bruto de R$ 63,00;
- soma do pagamento combinado usando o líquido;
- cálculo de taxa de R$ 2,00;
- rejeição de bruto menor que líquido;
- persistência separada de líquido, bruto e taxa;
- integridade do ZIP e ausência de referências à versão anterior.

A confirmação definitiva depende do deploy e do Firestore real.
