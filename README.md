# Sistema de Vendas Escola Piaget — 1.6.0-rc2.7.10

**Candidata:** RC2.7.9 — Domínio e experiência pré-operação

Baseada na RC2.7.7, cujo checkout foi validado pelo usuário após o hotfix de autorização. Esta candidata organiza a experiência pública do **Meu Piaget**, os documentos enviados às famílias e pequenos fluxos operacionais da Secretaria, sem redesenhar o pagamento ou a conta familiar.

## Domínios

### Responsáveis

`https://meupiaget.com.br`

O domínio raiz é o endereço canônico. No mesmo projeto Vercel, acessos ao `/` por esse hostname são servidos como Meu Piaget. `www.meupiaget.com.br` deve redirecionar para o domínio raiz na configuração da Vercel.

### Equipe

A Equipe Piaget pode continuar no domínio técnico já usado na Vercel. O domínio da Equipe não precisa aparecer em PDFs, QR Codes ou mensagens destinadas aos responsáveis.

### Variáveis recomendadas na Vercel

```text
PUBLIC_FAMILY_BASE_URL=https://meupiaget.com.br
PUBLIC_API_BASE_URL=https://vendas-piaget.vercel.app
```

A segunda variável mantém o webhook da InfinitePay em um endereço técnico estável. Se não for definida, o backend usa o host técnico da requisição quando adequado.

## Fluxos preservados

- primeiro acesso: CPF + matrícula;
- acessos seguintes: CPF + senha criada;
- recuperação de senha por link gerado pela Secretaria;
- conta financeira familiar compartilhada;
- carrinho multi-aluno;
- programação de lanches por aluno, com cópia entre irmãos;
- checkout e confirmação InfinitePay server-side;
- venda online da Secretaria;
- caixa físico com sessões e períodos de responsabilidade;
- Marco Zero manual.

## Mudanças desta candidata

- retorno pós-InfinitePay volta ao Meu Piaget;
- PDFs familiares padronizados e direcionados ao domínio oficial;
- login do Meu Piaget com feedback visual de carregamento;
- notificações de bloqueio e regularização da conta;
- dinheiro indisponível não bloqueia Pix/cartão/saldo quando o caixa está fechado;
- carrinho presencial não concluído pode ser recuperado;
- menu redundante removido do Meu Piaget;
- pedidos familiares mostram período do lanche e ação Detalhar.

## Segurança

A arquitetura de segurança preparada na RC2.7.6/RC2.7.7 foi mantida. Os responsáveis não precisam ser cadastrados manualmente no Firebase Authentication; a identidade técnica é criada após o login próprio do Meu Piaget.

**As Firestore Rules restritivas ainda não devem ser ativadas só por subir este ZIP.** Primeiro valide o domínio novo, login, checkout, PDFs e fluxos da Equipe. Depois siga `GUIA-ATIVACAO-SEGURANCA-RC2.7.9.md`.

## Marco Zero

O Marco Zero continua manual e não é executado no deploy.


## Hotfix de domínio RC2.7.9
A raiz do domínio familiar usa redirect por hostname e fallback no HTML para contornar a precedência do `index.html` físico na Vercel. O endereço exibido ao responsável permanece `https://meupiaget.com.br`.


## RC2.7.10 — hotfix de cobrança direta
Correção isolada do fluxo de regularização/entrada na conta após a RC2.7.9. A experiência e os demais módulos permanecem preservados.
