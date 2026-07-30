# Sistema de Vendas Escola Piaget — V1.3.1

Versão de correção focada no acesso do responsável após redefinição de senha.

## Problema corrigido

Na V1.3.0, o link temporário era gerado e a tela de redefinição aparecia, mas o fluxo podia não liberar corretamente o acesso posterior do responsável pelo portal.

## Correção aplicada

A V1.3.1 endurece o fluxo:

1. A secretaria/gestão gera um link com `resetId`, `resetAluno` e `resetToken`.
2. O responsável abre o link e cria nova senha.
3. O sistema valida o documento exato do reset.
4. O token é marcado como usado.
5. A senha é gravada no documento `acessos_responsaveis/{alunoId}`.
6. A sessão do responsável é criada imediatamente.
7. O portal do aluno é aberto após a redefinição.

A versão continua aceitando links antigos da V1.3.0 que ainda tenham apenas `resetAluno` e `resetToken`.

## Como atualizar

Suba a pasta completa da V1.3.1 na Vercel, incluindo:

- `index.html`
- `obrigado.html`
- `assets/`

Depois abra com `Ctrl + F5`.

Não apague nem reinicialize o Firestore.

## Teste recomendado

1. Entrar como Lucas ou secretaria.
2. Ir em Usuários e acessos.
3. Buscar um aluno.
4. Gerar link temporário de redefinição.
5. Abrir o link em aba anônima ou outro navegador.
6. Criar nova senha.
7. Confirmar se o portal do responsável abre imediatamente.
8. Sair e entrar novamente por matrícula + senha.
