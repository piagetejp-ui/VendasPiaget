# Domínio oficial — Meu Piaget

## Endereço canônico

`https://meupiaget.com.br`

## Configuração Vercel

- `meupiaget.com.br` → Production
- `www.meupiaget.com.br` → 308 Permanent Redirect → `meupiaget.com.br`

No hostname `meupiaget.com.br`, a raiz `/` é roteada internamente para `meu-piaget.html`. O responsável não precisa conhecer nem digitar esse nome de arquivo.

## DNS no Registro.br

Manter os servidores DNS do Registro.br. Quando a transição da zona terminar, usar modo avançado e criar:

| Tipo | Nome | Dados |
|---|---|---|
| A | `@` (ou vazio, se a interface representar assim o domínio raiz) | `216.198.79.1` |
| CNAME | `www` | `32f921b9cac008ec.vercel-dns-017.com.` |

Os valores acima foram os apresentados pela Vercel para este projeto em 08/08/2026. Se a Vercel passar a exibir valores diferentes antes da configuração, prevalecem os valores mostrados no painel do projeto.

## Variáveis de ambiente

```text
PUBLIC_FAMILY_BASE_URL=https://meupiaget.com.br
PUBLIC_API_BASE_URL=https://vendas-piaget.vercel.app
```

- `PUBLIC_FAMILY_BASE_URL`: links, PDFs, reset, venda online e redirect do responsável.
- `PUBLIC_API_BASE_URL`: endereço técnico usado pelo webhook InfinitePay.

## Firebase

Depois de DNS/HTTPS ativos, adicionar `meupiaget.com.br` em Firebase Authentication → Settings → Authorized domains antes do primeiro teste de login no domínio personalizado.

## URLs que devem usar o domínio público

- primeiro acesso;
- redefinição de senha;
- venda online enviada pela Secretaria;
- regularização de saldo;
- PDFs e QR Codes para responsáveis;
- redirect da InfinitePay;
- botão Voltar ao Meu Piaget.

A Equipe pode continuar no endereço Vercel técnico.
