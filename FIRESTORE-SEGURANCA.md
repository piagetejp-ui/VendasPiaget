# Firestore — segurança RC2.7.15

## Situação de produção/piloto

A regra aberta abaixo é apenas referência histórica de desenvolvimento e **não deve ser usada**:

```text
match /{document=**} {
  allow read, write: if true;
}
```

A RC2.7.15 mantém o Firestore fechado e separa a autorização da equipe da autorização das famílias.

## Equipe Piaget

Fluxo mantido:

Firebase Authentication por e-mail/senha → backend valida ID Token + `usuarios_acesso` → backend sincroniza `usuarios_auth/{uid}` → Firestore Rules reconhece funcionário ativo.

## Meu Piaget

Fluxo da RC2.7.15:

CPF/senha → API Piaget valida a credencial → cria `sessoes_meu_piaget/{sessionId}` → cria `familias_auth/{sessionId}` → emite Firebase Custom Token → navegador valida os claims → backend executa `family_auth_probe` → Firestore Rules reconhecem a sessão familiar.

O UID Firebase permanece estável por família. O documento `familias_auth/{sessionId}` é específico da sessão e contém:

- `firebaseUid`;
- `responsavelId`;
- `sessionId`;
- `alunosIds`;
- `ativo`;
- `expiraEm` / `expiraEmMs`.

As Rules verificam o espelho antes de permitir leituras do portal. Logout, bloqueio de acesso e revogação de sessões inativam o espelho correspondente.

Não é necessário cadastrar manualmente cada responsável no Firebase Authentication.

## Publicação das Rules

O pacote contém duas cópias equivalentes:

- `firestore.rules`;
- `FIRESTORE-RULES-PARA-COLAR.txt`.

Para o hotfix do Meu Piaget funcionar, **a aplicação RC2.7.15 e as Rules RC2.7.15 precisam estar publicadas**. O pacote não publica Rules automaticamente.

Consulte `GUIA-HOTFIX-MEU-PIAGET-RC2.7.15.md` para o teste mínimo.
