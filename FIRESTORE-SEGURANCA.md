# Firestore — segurança antes do piloto externo

As regras atualmente informadas são de desenvolvimento:

```text
match /{document=**} {
  allow read, write: if true;
}
```

Isso deixa o banco acessível sem autenticação e não é adequado para liberar o Meu Piaget a responsáveis externos.

## Por que esta candidata não fecha as regras automaticamente

O frontend ainda realiza leituras e algumas escritas diretamente no Firestore. Fechar as regras de forma genérica agora poderia quebrar Equipe Piaget, Meu Piaget, catálogo, pedidos, notificações e os novos fluxos da Secretaria.

A RC2.7.3 também passa a usar diretamente, entre outras, as coleções:

- `lancamentos_manuais`;
- `fechamentos_semanais`;
- `fechamentos_semanais_familias`;
- `movimentos_conta`;
- contas financeiras e pedidos operacionais já existentes.

## Etapa obrigatória antes do piloto externo

1. mapear todas as coleções acessadas diretamente por cada perfil;
2. definir autenticação Firebase compatível com a sessão familiar ou mover acessos sensíveis para APIs server-side;
3. criar regras por perfil, família e aluno;
4. testar Equipe, Cantina, Secretaria, Gestão e Meu Piaget;
5. somente então substituir as regras abertas.
