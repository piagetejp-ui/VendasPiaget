# Sistema de Vendas Piaget — V1.3.3

Versão focada em segurança do acesso do responsável.

## Correção principal

Na V1.3.2, após o responsável criar senha, ainda era possível entrar pelo fluxo de validação inicial com matrícula + data de nascimento/iniciais. Isso contrariava a regra definida para segurança.

Na V1.3.3:

- se a matrícula já tiver senha ativa, o fluxo de primeiro acesso é bloqueado;
- matrícula + data de nascimento/iniciais só funciona quando ainda não existe senha ativa para aquela conta;
- se o responsável esquecer a senha, ele deve falar com a secretaria;
- secretaria/gestão gera link temporário de redefinição;
- o botão de reset para primeiro acesso foi removido do fluxo normal de gestão do acesso do responsável;
- a tentativa de usar primeiro acesso após senha criada gera auditoria.

## Regra vigente do responsável

1. Primeiro acesso: matrícula + validação inicial.
2. Depois que criar senha: matrícula + senha.
3. Esqueci minha senha: não redefine sozinho.
4. Secretaria/gestão libera novo acesso por link temporário.
5. Link temporário: uso único e validade curta.

## Atualização

Suba a pasta completa:

- `index.html`
- `obrigado.html`
- `assets/`

Não apague o Firestore e não reinicialize a base.

## Teste recomendado

1. Escolha um aluno sem senha ativa.
2. Entre no portal por primeiro acesso.
3. Crie uma senha.
4. Saia.
5. Tente entrar de novo por primeiro acesso usando data de nascimento/iniciais.
6. O sistema deve bloquear e exigir senha.
7. Entre com matrícula + senha.
8. Deve abrir normalmente a página do aluno.
9. Teste o link temporário de redefinição pela secretaria/gestão.
