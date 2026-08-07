# Firestore — segurança RC2.7.6

## Situação anterior

A regra de desenvolvimento:

```text
match /{document=**} {
  allow read, write: if true;
}
```

não deve permanecer em uso real. Ela permite acesso direto ao banco sem autenticação.

## Arquitetura adotada

### Equipe Piaget

Firebase Authentication por e-mail/senha → backend valida ID Token + `usuarios_acesso` → backend mantém `usuarios_auth/{uid}` → Firestore Rules libera o funcionário ativo.

### Meu Piaget

CPF/senha ou CPF/matrícula → API Piaget valida credencial → cookie de sessão HttpOnly → API emite Firebase Custom Token técnico → Firestore Rules reconhece `responsavelId`, `sessionId` e alunos da família.

O responsável não recebe acesso a:

- `responsaveis_acesso`;
- `responsaveis_financeiros`;
- `sessoes_meu_piaget`;
- ativações e resets;
- auditoria;
- contas de outras famílias;
- saldos ou dados de outros alunos.

A sessão citada no Custom Token é conferida novamente pelas Rules, inclusive status e expiração. Assim, bloquear/revogar a sessão interrompe o acesso mesmo antes de vencer o ID Token técnico.

## Gravações do responsável

Direto pelo Firestore ficam apenas operações de baixo risco e estritamente vinculadas à família, como dados do comprador e marcação de leitura de notificações. A conta financeira passa a ser somente leitura no navegador; alterações de autorização/limite passam pela API.

Compras, pagamentos, cancelamentos, remarcações e operações que alteram saldo/estoque continuam em APIs server-side que validam a sessão e o vínculo do aluno.

## Limitação deliberada desta etapa

Para evitar regressão antes da auditoria final da Cantina, um funcionário interno autenticado e ativo ainda tem acesso técnico amplo ao Firestore. A interface continua aplicando os perfis/permissões existentes. Depois de validar completamente o operador de Cantina, é recomendável endurecer as Rules internas por função.

Isso é diferente da situação anterior: acesso anônimo e acesso de uma família aos dados de outra família deixam de existir com as novas Rules.
