# Changelog — V1.3.3

## Corrigido

- Bloqueado o acesso por validação inicial quando a conta do responsável já possui senha ativa.
- Reforçada a mensagem de segurança no fluxo de primeiro acesso.
- Corrigida a lógica para impedir que matrícula + data de nascimento/iniciais continuem valendo depois da criação da senha.

## Alterado

- O gestor/secretaria não vê mais, no fluxo normal, o botão de resetar senha para primeiro acesso.
- A redefinição passa a ser orientada preferencialmente por link temporário gerado pela secretaria/gestão.
- Tentativas de primeiro acesso em conta com senha ativa agora geram auditoria.

## Mantido

- Login por senha do responsável.
- Link temporário de redefinição.
- Login interno por Firebase Authentication.
- Perfis e permissões da equipe.
- Caixa, vendas, estoque, relatórios e identidade visual sem alteração funcional nesta versão.
