# Roteiro de testes — 1.6.0-rc2.7.3

## Antes de testar

- Publicar a candidata completa.
- Não executar o Marco Zero.
- Não alterar ainda as regras abertas do Firestore.
- Usar dados de teste para lançamentos, bloqueios e regularizações.

## 1. Login e versão

- Abrir a Equipe Piaget.
- Confirmar que o formulário de e-mail/senha está centralizado.
- Entrar como Secretaria e como Gestão.
- Confirmar que a versão aparece apenas como `1.6.0-rc2.7.3`, sem texto como “Família Compartilhada”.

## 2. Extrato e Movimentações — duplicidade

- Fazer uma venda online da Secretaria e concluir o pagamento usando uma família de teste.
- Abrir o Extrato/Movimentações da família no Meu Piaget.
- Abrir a ficha familiar pela Secretaria e conferir a aba Movimentações.
- A venda e o pagamento técnico do mesmo checkout devem aparecer como **uma única operação visível**.
- Abrir `Detalhar` para confirmar que a compra continua rastreável.
- Confirmar que uma cobrança antiga e um pagamento feito depois continuam como fatos separados quando forem operações econômicas distintas.

## 3. Nome do aluno padronizado

Conferir, pelo menos, em:

- Notificações;
- Vendas da Secretaria;
- Cobranças;
- Pedidos;
- Movimentações/Extrato quando houver referência a aluno.

Esperado: **nome + turma atual + referência clicável** para abrir a ficha correspondente.

## 4. Pedidos — dois níveis de cards

- Abrir Pedidos.
- Confirmar cards gerais acima das categorias.
- Clicar em cada card geral e confirmar que a lista é filtrada.
- Selecionar Cantina e confirmar cards específicos abaixo das categorias.
- Testar os filtros de entregas de hoje, agendadas, abertos e exceções.
- Selecionar Fardamento e conferir os cards específicos da categoria.
- Confirmar que os cards gerais permanecem visíveis enquanto os específicos mudam com a categoria.

## 5. Lançar pendência anterior

Use uma família de teste.

- Abrir Alunos e Contas e entrar na ficha do aluno.
- Clicar `Lançar pendência anterior`.
- Registrar um lanche retroativo de valor pequeno, com data anterior à data atual.
- Confirmar:
  - criação do pedido/registro;
  - movimentação na conta;
  - saldo familiar reduzido;
  - status `aguardando pagamento`;
  - exibição no Meu Piaget;
  - data da operação retroativa, sem perder o registro de quem lançou hoje.
- Tentar repetir exatamente aluno + data + descrição + valor e confirmar o alerta de possível duplicidade.
- Se testar fardamento retroativo, confirmar que o lançamento histórico não baixa estoque automaticamente.

## 6. Fechamento semanal familiar

**Atenção:** confirmar o fechamento bloqueia todas as contas negativas apresentadas na prévia. Primeiro veja a prévia. Se houver várias contas de teste que você não quer bloquear, pare nessa etapa.

- Abrir Cobranças → Fechamento semanal.
- Conferir quantidade de contas familiares negativas e total em aberto.
- Confirmar que o fechamento informa que não cria nova dívida.
- Se a prévia estiver segura para teste, clicar `Bloquear todos e iniciar fechamento`.
- Na fila de Fechamentos semanais:
  - baixar o PDF de uma família;
  - conferir alunos, turma, itens, datas, valores e total familiar;
  - conferir instruções do Meu Piaget e opção de solicitar link à Secretaria;
  - clicar `Marcar enviado` e confirmar status `Enviado · aguardando`;
  - gerar/abrir o link de regularização.
- Regularizar uma família de teste e atualizar Cobranças.
- Confirmar que ela passa para `Regularizado` e o bloqueio semanal deixa de existir.
- Tentar iniciar outro fechamento no mesmo dia e confirmar que o sistema não duplica o fechamento ativo.

## 7. Regressão da família compartilhada

- Família com mais de um aluno deve continuar em uma única visão.
- Carrinho da Secretaria pode continuar misturando itens de alunos diferentes.
- Programação de lanche multi-aluno e `Copiar programação de ...` devem continuar funcionando.
- Comprador continua independente do responsável financeiro.

## 8. Gestão x Secretaria — acessos

- Na Secretaria, confirmar que `Usuários e Acessos` não existe como módulo separado.
- Confirmar que acesso da família continua em Alunos e Contas.
- Na Gestão, confirmar que `Usuários e Acessos` continua disponível para administrar usuários internos.

## 9. Regressão rápida do Caixa

- Abrir Caixa e conferir situação, responsável atual e histórico.
- Se houver ambiente de teste adequado, executar uma operação curta já conhecida.
- Não houve alteração funcional intencional no núcleo de responsabilidade do caixa.

## Critério para avançar

Somente depois destes testes da Secretaria estarem satisfatórios deve-se iniciar a rodada específica do operador de Cantina. O Marco Zero continua para depois da validação geral.
