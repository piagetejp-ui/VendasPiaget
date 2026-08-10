# Firestore — segurança RC2.7.8

## Situação de desenvolvimento

A regra abaixo não é adequada para operação real:

```text
match /{document=**} {
  allow read, write: if true;
}
```

## Arquitetura preparada

### Equipe Piaget

Firebase Authentication por e-mail/senha → backend valida ID Token + cadastro interno → Firestore Rules reconhece funcionário ativo.

### Meu Piaget

CPF/senha ou CPF/matrícula → API Piaget valida credencial → cookie de sessão HttpOnly → API emite Firebase Custom Token técnico → Firestore Rules reconhece a família e os alunos vinculados.

Não é necessário cadastrar manualmente todos os responsáveis no Firebase Authentication.

## Domínio personalizado

Antes de testar a identidade técnica no domínio oficial:

1. DNS de `meupiaget.com.br` deve estar válido na Vercel;
2. HTTPS deve estar ativo;
3. adicionar `meupiaget.com.br` em Firebase Authentication → Settings → Authorized domains;
4. se a chave web do Firebase tiver restrições manuais por HTTP referrer no Google Cloud, adicionar o domínio também nessa lista.

## Ativação das Rules

O pacote contém `firestore.rules` e `FIRESTORE-RULES-PARA-COLAR.txt`, mas **não publique essas Rules antes de validar a RC2.7.8 com as regras atuais**.

A sequência completa está em `GUIA-ATIVACAO-SEGURANCA-RC2.7.11.md`.
