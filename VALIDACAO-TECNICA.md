# Validação técnica — 1.6.0-rc2.3.2-lanches-multiplos-produtos

Validações locais executadas:

- sintaxe de todos os arquivos JavaScript;
- carregamento dos 16 módulos frontend em um mesmo contexto;
- carregamento das 12 APIs com Firebase Admin simulado;
- seleção de três produtos na mesma data;
- seleção de produtos diferentes em duas datas;
- cálculo de total por item, por data e do pedido completo;
- salvamento do rascunho com uma lista de itens por data;
- consolidação de produtos repetidos na mesma data;
- bloqueio, no backend, de mais de 10 unidades do mesmo produto por data;
- normalização de uma programação com três produtos em um dia e um combo em outro;
- expansão dos componentes do combo e cálculo da quantidade de salgados;
- ausência de referências à versão anterior;
- integridade estrutural do pacote e do ZIP.

A confirmação definitiva depende do deploy e dos testes com o Firestore e a InfinitePay reais.
