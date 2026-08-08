# Guia de ativação de segurança — RC2.7.8

## Regra de ouro

**Domínio e código primeiro. Firestore Rules depois.**

## Etapa 1 — domínio

No Registro.br, quando a zona sair de transição, manter os servidores DNS do Registro.br e criar:

```text
A      @      216.198.79.1
CNAME  www    32f921b9cac008ec.vercel-dns-017.com.
```

Na Vercel:

- `meupiaget.com.br` → Production;
- `www.meupiaget.com.br` → 308 Permanent Redirect → `meupiaget.com.br`.

Aguarde a Vercel mostrar configuração válida/HTTPS ativo.

## Etapa 2 — Firebase Authentication

Firebase Console → Authentication → Settings → Authorized domains → adicionar:

```text
meupiaget.com.br
```

Se houver restrição manual de HTTP referrer na API key no Google Cloud, adicionar também `https://meupiaget.com.br/*`.

## Etapa 3 — variáveis Vercel

Recomendadas para Production:

```text
PUBLIC_FAMILY_BASE_URL=https://meupiaget.com.br
PUBLIC_API_BASE_URL=https://vendas-piaget.vercel.app
```

Depois de alterar variáveis, fazer novo deploy para garantir que as Functions usem os valores atuais.

## Etapa 4 — publicar RC2.7.8 mantendo as Rules atuais

Testar:

- Equipe;
- Meu Piaget no domínio novo;
- família com irmãos;
- venda online;
- checkout e retorno da InfinitePay;
- PDF de primeiro acesso;
- PDF de fechamento semanal;
- venda presencial Pix/cartão com caixa fechado;
- rascunho de carrinho;
- notificações de bloqueio/regularização.

Se algum item crítico falhar, **não publique as novas Rules**.

## Etapa 5 — publicar as Firestore Rules

Firebase Console → Firestore Database → Rules:

1. guardar uma cópia da regra anterior;
2. colar `firestore.rules` ou `FIRESTORE-RULES-PARA-COLAR.txt`;
3. validar no console;
4. publicar;
5. aguardar propagação.

## Etapa 6 — regressão pós-Rules

- acesso anônimo não lê Firestore;
- família A acessa somente dados permitidos da família A;
- Gestão, Secretaria e Cantina continuam funcionando;
- login/reload/logout do Meu Piaget;
- carrinho multi-aluno;
- notificações e extrato;
- checkout InfinitePay e retorno;
- venda presencial e caixa.

## Etapa 7 — piloto

Somente depois da regressão pós-Rules: iniciar piloto controlado com poucos responsáveis. O Marco Zero continua separado e manual.
