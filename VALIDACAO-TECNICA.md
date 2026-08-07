# Validação técnica — RC2.7

## Escopo validado localmente

- Sintaxe de todos os JavaScripts de frontend e APIs.
- Parse dos JSONs de configuração/build.
- Referências locais dos três HTMLs principais.
- Service worker e precache da release.
- Ausência de referências físicas a releases RC2.0–RC2.6 no runtime.
- Estrutura da base oficial: 214 alunos, 187 responsáveis, 214 vínculos e 24 responsáveis com irmãos.
- CPFs válidos armazenados somente como hash na base server-side; nenhum CPF completo embarcado como campo de consulta no frontend.
- A lista histórica de alunos com dados pessoais foi removida do JavaScript estático público; o Meu Piaget recebe apenas os alunos vinculados à sessão familiar.
- Um CPF incompleto do relatório é mantido como pendência e não é inferido.
- Núcleo `16-cash-responsibility.js` comparado com RC2.6 após neutralização do nome da versão: conteúdo funcional igual.
- Preparação da base é distinta do Marco Zero.
- Conta familiar recém-criada preserva o saldo líquido agregado das contas legadas até o reset oficial.
- URLs públicas de pagamento/reset preparadas para `PUBLIC_FAMILY_BASE_URL`.
- Webhook preparado para `PUBLIC_API_BASE_URL`.

## Limites desta validação

- Não houve deploy pela assistente.
- Não houve execução contra o Firestore real do usuário.
- Não houve checkout InfinitePay real nesta validação local.
- A separação por dois domínios customizados depende da configuração posterior na Vercel; nesta candidata já existem entradas independentes `/equipe.html` e `/meu-piaget.html`.
- As regras de segurança existentes do Firestore continuam fazendo parte da arquitetura herdada; a RC2.7 reduz a carga de dados no navegador familiar e exige sessão familiar nas APIs críticas alteradas, mas não reescreve toda a camada de acesso do Firestore.

## Status

**Candidata para teste real controlado.** Não declarar validada antes da publicação e do roteiro de teste.
