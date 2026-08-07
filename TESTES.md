# Roteiro de teste — RC2.7

## Regra principal

**Não executar o Marco Zero no início do teste.** Primeiro validar a nova arquitetura com os dados de teste existentes.

## 1. Publicação e versão

- Publicar todo o ZIP.
- Abrir `/equipe.html` e confirmar **Equipe Piaget**.
- Abrir `/meu-piaget.html` e confirmar **Meu Piaget**.
- Confirmar a versão `1.6.0-rc2.7-meu-piaget-familias`.

## 2. Regressão da equipe

Testar com Lucas/Gestão e Secretaria:

- login da equipe;
- Vendas;
- Pedidos;
- fardamento;
- notificações;
- abertura de Caixa;
- assunção/conferência;
- entrada e saída;
- venda em dinheiro;
- fechamento.

O núcleo do caixa não foi refeito nesta release.

## 3. Preparar a base oficial

Em Gestão → Configurações → **Meu Piaget e implantação**:

- clicar em **Preparar base oficial**;
- confirmar 214 alunos e 187 responsáveis;
- confirmar que o histórico operacional ainda existe;
- conferir que saldos de teste não foram zerados por esta etapa;
- verificar o cadastro com CPF pendente e corrigi-lo com o dado oficial da escola/SIGA.

Não inventar o CPF ausente no relatório.

## 4. Família com um aluno

Escolher um responsável de aluno único:

- primeiro acesso com CPF + matrícula;
- criar senha;
- sair;
- entrar novamente com CPF + senha;
- conferir aluno, turma, pedidos, saldo e limite;
- realizar uma compra/pedido de teste;
- conferir que o comprador pode ser diferente do responsável financeiro.

## 5. Família com irmãos

Escolher um dos responsáveis com mais de um aluno:

- primeiro acesso usando a matrícula de apenas um dos filhos;
- confirmar que todos os filhos vinculados aparecem;
- alternar entre alunos;
- confirmar que pedidos/lanche/farda permanecem vinculados ao filho selecionado;
- confirmar que saldo, autorização e limite são iguais ao trocar de aluno;
- conferir extrato da família identificando o aluno de origem de cada movimento;
- confirmar que o limite máximo considera a quantidade de alunos ativos.

A RC2.7 não cria um carrinho único multi-irmãos: a operação continua sendo montada para o aluno selecionado. O compartilhamento nesta release é de acesso e conta financeira.

## 6. Recuperação de senha

No Meu Piaget:

- solicitar redefinição pelo CPF;
- na Equipe Piaget, abrir o acesso da família;
- gerar link temporário;
- copiar e abrir o link;
- criar nova senha;
- confirmar acesso e invalidação do link usado.

## 7. Venda online / InfinitePay

- gerar venda online pela Secretaria;
- abrir o link público;
- conferir aluno e itens;
- editar dados do comprador;
- testar checkout;
- conferir retorno em `obrigado.html` e botão de volta ao Meu Piaget.

Antes de usar domínios separados em produção, configurar `PUBLIC_FAMILY_BASE_URL` e `PUBLIC_API_BASE_URL` na Vercel.

## 8. Marco Zero — apenas depois de aprovar os testes

- abrir a prévia;
- conferir as quantidades de vendas, pedidos, caixa, notificações e demais dados de teste;
- conferir o que será preservado;
- confirmar que não há CPF pendente;
- somente então digitar `INICIAR OPERAÇÃO REAL`;
- validar criação do backup;
- confirmar que históricos de teste sumiram das telas;
- confirmar saldos familiares zerados;
- confirmar estoque atual preservado;
- confirmar catálogo/preços preservados;
- confirmar alunos, turmas, responsáveis e vínculos preservados;
- abrir um novo caixa e registrar a primeira operação oficial.
