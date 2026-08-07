# Changelog — 1.6.0-rc2.7.3

## Fechamento da etapa Secretaria

### Extrato e Movimentações

- Consolidada a apresentação de venda da Secretaria + pagamento quando representam a mesma operação econômica.
- A consolidação funciona independentemente da ordem em que os dois registros técnicos foram gravados.
- Extrato e Movimentações mostram uma única linha para a compra, mantendo os lançamentos originais no banco para auditoria.
- Operações economicamente distintas continuam separadas, como compra a prazo e pagamento feito posteriormente.

### Login da equipe e versão

- Centralizado o formulário de login interno da Equipe Piaget.
- Removido da apresentação visual da versão qualquer subtítulo de release.
- Padrão visível: `1.6.0-rc2.7.3`.

### Referência de aluno

- Criada referência visual reutilizável com nome + turma + navegação para a ficha do aluno.
- Aplicada a notificações e às principais listas de Vendas, Cobranças e Pedidos, com complementação automática nas telas herdadas.

### Pedidos

- Cards gerais de urgência mantidos no topo, antes das categorias.
- Cards contextuais adicionados logo abaixo da categoria escolhida.
- Indicadores de Cantina contemplam entregas de hoje, agendadas, pedidos em aberto e exceções.
- Indicadores de Fardamento contemplam produção, pronto para entrega, abertos e recentes.
- Demais categorias recebem indicadores contextuais de abertos, semana, recentes e concluídos.
- Todos os cards funcionam como filtros operacionais.

### Lançamento manual / retroativo

- Adicionada ação `Lançar pendência anterior` em Alunos e Contas para Secretaria, Gestão e Admin.
- Permite escolher aluno vinculado, data real da operação, categoria, situação operacional, descrição, quantidade e valor.
- Pagamento nasce como `aguardando_pagamento`.
- Atualiza a conta financeira familiar e cria movimentação e pedido correspondentes.
- Guarda separadamente data da operação e data/hora/autor do registro.
- Incluída verificação de possível duplicidade antes de gravar.
- Lançamento retroativo de fardamento não altera estoque automaticamente.

### Fechamento semanal familiar

- Fechamento semanal redesenhado para a conta familiar.
- Prévia exibe quantidade de famílias negativas e valor total em aberto.
- Ação `Bloquear todos e iniciar fechamento` aplica bloqueio às contas pendentes.
- Fechamento não gera nova dívida; cria apenas fotografia das pendências já existentes.
- Criada fila por família com estados:
  - Pendente de envio;
  - Enviado / aguardando regularização;
  - Regularizado.
- PDF por família com valores agrupados por aluno, total em aberto e instruções de autorregularização.
- Secretaria pode marcar o documento como enviado e gerar link de regularização.
- Ao saldo familiar voltar a zero ou positivo, o bloqueio semanal é removido e a cobrança é marcada como regularizada.
- Evitado novo fechamento familiar no mesmo dia quando já houver um ativo.

## Preservações

- Arquitetura familiar multi-aluno da RC2.7.2 preservada.
- 10 funções serverless em `/api`.
- Marco Zero continua manual.
- Nenhuma regra do Firestore é alterada automaticamente.
- Núcleo do caixa físico preservado funcionalmente em relação à RC2.7.2.
