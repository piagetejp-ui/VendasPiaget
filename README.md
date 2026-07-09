# Escola Piaget — Sistema de Vendas V1.2.2

Atualização focada exclusivamente em identidade visual da interface e no relatório da conta do aluno.

## O que mudou

### Marca no sistema
- O arquivo `logo-piaget-icon.png` agora é realmente o símbolo simples oficial, sem o nome da escola embutido.
- Cabeçalho fixo: símbolo simples + texto `Escola Piaget` + subtítulo do sistema.
- Tela de escolha de acesso: símbolo simples em escala legível + nome do sistema; removida a assinatura completa reduzida.
- Telas de setup/carregamento: símbolo simples em escala adequada.
- Portal do responsável em fundo azul: usa a variação branca com detalhe laranja, sem caixa branco.
- Foram adicionadas variações de símbolo para contraste:
  - `assets/logo-piaget-icon.png`
  - `assets/logo-piaget-icon-white-orange.png`
  - `assets/logo-piaget-icon-blue-white.png`
  - `assets/logo-piaget-icon-white.png`

### Relatório da conta
- QR Code removido do PDF e da imagem para WhatsApp.
- O link para abrir a conta do aluno ganhou destaque visual.
- Incluídas instruções claras de consulta:
  1. tocar ou copiar o link;
  2. abrir no navegador do celular;
  3. conferir lançamentos, saldo e opções disponíveis.
- A identidade visual institucional dos documentos foi preservada.

## Escopo preservado
Esta versão não altera regras de venda, caixa, estoque, Firestore, pedidos ou pagamentos.

## Atualização
Suba a pasta completa para a Vercel, preservando a pasta `assets/`.
Não é necessário apagar ou migrar dados do Firestore.
