# Sistema de Vendas Escola Piaget — 1.6.0 RC2.5.1

**Release:** `1.6.0-rc2.5.1-fardamento-variacoes`  
**Base:** RC2.4.1 validada pelo usuário em ambiente real quanto ao caixa físico.  
**Status:** candidato para teste após publicação.

## Publicação

Envie **todo o conteúdo desta pasta** ao repositório, preservando:

- `index.html` na raiz;
- `api/`, `assets/` e `releases/` na hierarquia atual;
- a pasta física `releases/1.6.0-rc2.5.1-fardamento-variacoes/`;
- `version.json` e `sw.js` desta mesma versão.

## Escopo da RC2.5

- Carrinho persistente durante a montagem das vendas da Secretaria.
- Programação de lanches detalhada por data, produto e quantidade.
- Ajuste da experiência equivalente no programador de lanches do responsável.
- Gestão do caixa com navegação por ano, mês, dia, sessão e períodos de responsabilidade.
- Auditoria detalhada de cada caixa e suas movimentações.
- Classificação das saídas entre despesa real, transferência de numerário, sangria e retirada de sócio.
- Notificações contextualizadas por aluno, turma e origem.
- Distribuição de notificações por perfil e aluno destinatário.
- Separação entre notificações informativas e pendências acionáveis.
- Marcação como lida persistente e navegação contextual para aluno, pedido, venda, entrega, movimento e caixa.


## Fardamento na RC2.5.1

- Produto único **Camisa de farda**.
- Infantil/Juvenil: modelo único, tamanhos 04, 06, 08, 10, 12 e 14 anos.
- Adulto Feminino: Baby Look, tamanhos P, M, G, GG e EXGG.
- Adulto Masculino: tamanhos P, M, G, GG e EXGG.
- Estoque físico, reservado e disponível controlados por variação.
- Portal do responsável e vendas da Secretaria usam a mesma fonte de estoque.
- Tamanho sem disponibilidade continua visível no portal, mas não pode ser comprado.

## Regra de segurança

O núcleo do caixa físico validado na RC2.4.1 (`16-cash-responsibility.js`) foi preservado; a RC2.5 adiciona a experiência gerencial em uma camada posterior.
