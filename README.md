# Escola Piaget — Sistema de Vendas V1.2.0

Versão consolidada sobre a V1.1.0, mantendo os dados e IDs existentes no Firestore.

## Implantação

1. Faça o deploy da **pasta inteira**, não apenas do `index.html`.
2. Preserve a subpasta `assets/`, pois a interface usa os arquivos oficiais da marca.
3. Não apague o Firestore e não reinicialize alunos, contas ou vendas.
4. Abra a aplicação e faça um teste com um perfil interno antes de liberar uso operacional.

## O que mudou

### Identidade e experiência
- paleta principal da Escola Piaget;
- logotipo e ícone oficiais sem alterar proporção ou cores;
- navegação mais limpa e responsiva;
- telas específicas para secretaria, cantina, gestão e responsável;
- venda da secretaria em fluxo guiado de quatro etapas: cliente, itens, pagamento e confirmação;
- modais flutuantes para escolhas e pagamentos.

### Catálogo e estoque
- área `Produtos e estoque` com abas de produtos, estoque, movimentações, reposição e modelos de farda;
- modos de controle: unitário, capacidade diária, derivado/combos e sem controle;
- salgado continua com capacidade diária e configuração padrão existente;
- combos consomem os componentes, não um estoque próprio;
- venda interna da cantina, consumo em conta e venda da secretaria passam pela camada central de estoque;
- toda movimentação gera histórico em `movimentos_estoque`.

### Farda
- modelos e variações por tamanho/modelo;
- estoque por variação;
- item disponível pode ser entregue ou reservado;
- item indisponível não cria estoque negativo: segue para produção;
- portal do responsável permite solicitar/comprar farda e informa se há entrega imediata ou produção.

### Portal do responsável
- ações principais mais claras: pedir lanche, comprar farda, pagar em aberto e adicionar crédito;
- catálogo filtra produtos indisponíveis;
- validação de disponibilidade antes de iniciar checkout;
- histórico de pedidos de farda visível.

## Migração automática

Na primeira carga da V1.2, o sistema verifica `configuracoes/geral.v120Migrado`.

Quando necessário, cria somente a estrutura nova:
- campos de controle de estoque nos produtos existentes;
- documentos de estoque sem inventar quantidades;
- modelo padrão de camisa com tamanhos e preços já definidos no projeto;
- variações de farda;
- marca a migração como concluída.

**Importante:** produtos unitários existentes começam com estoque `não configurado`, e não com quantidade fictícia. Cadastre o estoque físico real antes de liberar a venda desses itens. Fardas sem estoque configurado/disponível seguem para produção.

## Limite técnico conhecido

O portal do responsável valida a disponibilidade antes de iniciar o checkout. Para proteção completa contra duas pessoas comprarem a última unidade ao mesmo tempo, a confirmação final de pagamento deve revalidar e reservar/baixar estoque em uma transação no backend/webhook. A V1.2 não finge que essa proteção já existe.

## Segurança

O Authentication continua propositalmente adiado. O arquivo `firestore.rules` incluído é **temporário para desenvolvimento** e permite leitura/escrita abertas. Não use essas regras em ambiente público ou definitivo.

## Arquivos principais
- `index.html` — aplicação;
- `obrigado.html` — retorno de pagamento;
- `firestore.rules` — regras temporárias de desenvolvimento;
- `assets/` — recursos visuais oficiais usados pela interface;
- `preview-v1.2.png` — prévia visual.
