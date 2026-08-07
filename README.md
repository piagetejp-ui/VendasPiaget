# Sistema de Vendas Escola Piaget — 1.6.0 RC2.6

**Release:** `1.6.0-rc2.6-pedidos-fardamento`  
**Base:** RC2.5.1, construída sobre a RC2.5 já testada pelo usuário.  
**Status:** candidata para publicação e teste real.

## Publicação

Envie **todo o conteúdo deste pacote** para o repositório, preservando `index.html` na raiz, as pastas `api/`, `assets/` e `releases/`, além de `version.json` e `sw.js`.

A pasta física desta release é:

`releases/1.6.0-rc2.6-pedidos-fardamento/`

## Principais mudanças

- **Camisa de farda** permanece como um único produto-pai, agora sem preço geral.
- Cada tamanho/modelo possui preço próprio, estoque físico, reservado, disponível, em produção e quantidade comprometida com alunos.
- Preços podem ser alterados individualmente ou em lote.
- Farda sem estoque pode ser comprada/solicitada normalmente; a falta entra na fila de produção.
- A reposição automática da variação respeita mínimo de 5 unidades quando não há produção livre suficiente.
- Unidades de produção que já possuem aluno ficam comprometidas e, ao chegar, são reservadas antes de liberar o saldo para estoque livre.
- **Pedidos** passa a ser a central operacional única para Cantina, Fardamento, Eventos, Serviços e cobranças, Mensalidades e Negociações.
- Pagamento e atendimento são exibidos como situações independentes.
- A Secretaria pode registrar entrega, ausência e estorno de pedidos de Cantina, com autoria preservada.
- Mudanças relevantes de pedidos são refletidas no portal do responsável e geram notificações quando aplicável.
- Notificações exibem aluno, turma e origem quando disponíveis e respeitam os destinatários por perfil/aluno.
- Campos de busca críticos filtram sem perder foco durante a digitação.
- Cards de resumo que representam subconjuntos de dados funcionam como filtros/atalhos.
- A interface foi revisada para reduzir nomenclatura técnica de desenvolvimento no uso cotidiano.

## Importante

Esta versão **não foi publicada nem testada contra o ambiente real pelo assistente**. Ela deve ser tratada como candidata até o usuário concluir os testes após publicação.
