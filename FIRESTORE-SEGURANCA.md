# Firestore — segurança antes do piloto externo

As regras atualmente informadas são de desenvolvimento:

```text
match /{document=**} {
  allow read, write: if true;
}
```

Isso deixa o banco acessível sem autenticação e não é adequado para liberar o Meu Piaget a responsáveis externos.

## Por que não substituir automaticamente neste hotfix

O frontend atual ainda realiza leituras e algumas escritas diretamente no Firestore. Fechar as regras de forma genérica agora poderia quebrar Equipe Piaget, Meu Piaget, catálogo, pedidos e notificações.

## Próxima etapa obrigatória antes do piloto externo

1. mapear as coleções acessadas diretamente pelo Meu Piaget;
2. definir autenticação Firebase compatível com a sessão familiar ou mover acessos sensíveis para APIs server-side;
3. criar regras por perfil e por família/aluno;
4. testar Equipe, Cantina, Secretaria, Gestão e Meu Piaget;
5. somente então substituir as regras abertas.
