# Escola Piaget — Sistema de Vendas V1.3.2

Versão focada na correção do acesso do responsável após redefinição de senha.

## Correção principal

Na V1.3.1, o link de redefinição podia salvar a nova senha e atualizar o topo como “Responsável”, mas não abrir a página do aluno. A auditoria encontrou uma recursão na função `renderParentPortal`, causada por captura incorreta da própria função durante o patch V1.3.0.

A V1.3.2 substitui esse ponto por uma renderização autônoma do portal do responsável. O fluxo corrigido é:

1. Secretaria/gestão gera link temporário.
2. Responsável abre o link.
3. Cria nova senha.
4. O token é validado e marcado como usado.
5. A senha é salva no acesso do aluno.
6. A sessão do responsável é aberta.
7. O portal do aluno é renderizado imediatamente.

## Teste recomendado

1. Entre como Lucas ou secretaria.
2. Abra **Usuários e acessos**.
3. Busque um aluno.
4. Gere um link temporário de redefinição.
5. Abra o link em aba anônima.
6. Crie uma nova senha.
7. Confirme se a página do aluno abre imediatamente.
8. Saia da conta.
9. Entre novamente por matrícula + senha.

## Observações

- Não é necessário apagar dados do Firestore.
- Suba a pasta completa, pois o sistema usa a pasta `assets/`.
- Esta versão não altera checkout InfinitePay, caixa, estoque ou vendas.
