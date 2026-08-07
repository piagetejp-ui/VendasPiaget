# Guia de ativação — RC2.7.6

## Regra de ouro

**Código primeiro. Rules depois.**

Se as novas Rules forem publicadas antes do código RC2.7.6 estar no ar, o Meu Piaget antigo não possui a identidade técnica necessária e pode parar de carregar dados.

## Etapa 1 — publicar o código

1. Mantenha uma cópia do ZIP/repositório atual como rollback.
2. Suba todo o conteúdo da RC2.7.6 no GitHub, substituindo a árvore anterior.
3. Aguarde o deploy da Vercel concluir.
4. Não altere as Rules ainda.

## Etapa 2 — smoke test com as Rules antigas

Faça apenas:

- login da Gestão/Secretaria;
- abrir Resumo e Alunos e Contas;
- login no Meu Piaget de uma família já ativada;
- abrir saldo, pedidos, movimentações e notificações;
- sair e entrar novamente no Meu Piaget.

Se isso falhar, **não publique as novas Rules** e volte para a RC2.7.5/última versão validada.

## Etapa 3 — publicar as Rules

1. Abra Firebase Console.
2. Selecione o projeto `vendaspiaget`.
3. Vá em **Firestore Database → Rules**.
4. Faça uma cópia local da regra atual apenas como registro histórico.
5. Substitua o conteúdo pelo arquivo `firestore.rules` desta versão (há também `FIRESTORE-RULES-PARA-COLAR.txt`).
6. Use o validador/Laboratório de regras do console.
7. Clique em **Publicar**.
8. Aguarde a propagação antes de considerar um erro de listener como definitivo.

## Etapa 4 — teste depois das Rules

### Equipe

- Gestão entra normalmente.
- Secretaria entra normalmente.
- Cantina entra normalmente.
- Usuário interno bloqueado não deve ganhar acesso.
- Alunos e Contas, Pedidos, Cobranças e Caixa carregam.

### Meu Piaget — família com um aluno

- CPF + senha entra.
- primeiro acesso CPF + matrícula continua igual;
- saldo abre;
- movimentações/extrato abrem;
- pedidos abrem;
- notificações abrem e podem ser marcadas como lidas;
- dados do comprador podem ser salvos;
- autorização/limite podem ser salvos;
- checkout InfinitePay pode ser criado;
- logout encerra o acesso.

### Meu Piaget — irmãos

- todos os alunos aparecem juntos;
- filtros funcionam;
- carrinho multi-aluno continua funcionando;
- programação copiada entre irmãos funciona;
- uma família não consegue carregar documento de aluno de outra família.

### Teste anônimo

Em uma janela anônima, sem login, o Firestore não deve fornecer dados diretamente. A página pública de pagamento continua funcionando por suas APIs próprias, sem liberar o banco inteiro.

## Etapa 5 — somente depois

- iniciar piloto com poucos responsáveis;
- observar logs/erros;
- só depois ampliar;
- Marco Zero continua uma ação separada e manual.
