# Validação técnica — 1.6.0-rc2.7.9

## Resultado local

- **43** arquivos JavaScript passaram em `node --check` (release, APIs, servidor e service worker).
- **4** arquivos JSON finais foram parseados com sucesso.
- **10** funções JavaScript físicas em `/api`, abaixo do limite observado de 12 da Vercel Hobby.
- Única release física: `releases/1.6.0-rc2.7.9/`.
- **83** referências locais dos cinco HTMLs principais foram conferidas, sem arquivo ausente.
- Service worker contém **9** itens de precache, todos resolvendo para arquivos existentes (a raiz `/` é rota virtual).
- Smoke HTTP estático retornou 200 para `/`, `index.html`, `equipe.html`, `meu-piaget.html`, `pagamento.html`, `obrigado.html`, `version.json` e `sw.js`.
- Nenhuma referência de runtime às releases RC2.7.0–RC2.7.7.
- Nenhuma referência de runtime ao domínio provisório `meu-piaget.vercel.app`.
- Nenhum CPF real completo foi encontrado na base estática; apenas máscaras/placeholder podem existir na interface.
- Nenhuma chave privada PEM/service-account foi encontrada no pacote.

## Caixa

`16-cash-responsibility.js` foi comparado com a RC2.7.7 validada. O diff possui somente dois pontos:

1. identificador da versão;
2. wrapper de abertura das formas de pagamento.

Sessões, responsabilidade, divergências, cálculo de saldo e confirmação em dinheiro não foram reescritos. Quando o caixa não está apto, o wrapper bloqueia apenas Dinheiro e deixa Pix/cartão/saldo disponíveis.

## Checkout

A correção de autorização da RC2.7.7 foi preservada. A RC2.7.8 altera apenas a separação de URL pública da família e URL técnica do webhook:

- redirect da InfinitePay → `PUBLIC_FAMILY_BASE_URL` / `meupiaget.com.br`;
- webhook → `PUBLIC_API_BASE_URL` / host técnico.

O destino financeiro/handle e a validação server-side do pagamento não foram alterados nesta rodada.

## Firestore Rules

- `firestore.rules` tem **156** linhas.
- Validação estática confirmou chaves/parênteses balanceados.
- Não existe `allow read, write: if true` no arquivo preparado.
- O emulador oficial do Firebase não foi executado neste ambiente; a avaliação semântica final deve ser feita no Firebase real.
- **As Rules preparadas não devem ser publicadas antes da regressão da RC2.7.8 no domínio personalizado.**

## PDFs

Os PDFs desta candidata são gerados em runtime com dados do Firestore. Foram validados estruturalmente no código, incluindo logo, textos, links e QR Code, mas não foi possível renderizar uma amostra fiel com dados reais neste ambiente.

Antes do piloto real, gerar e inspecionar visualmente no ambiente publicado:

- primeiro acesso;
- fechamento semanal/regularização;
- comprovante do responsável;
- comprovante de venda/fechamento de caixa quando aplicável.

A inspeção deve confirmar ausência de cortes, sobreposição, logo deformada e links incorretos.

## Dependências externas ainda necessárias

1. terminar a transição DNS no Registro.br e criar os registros pedidos pela Vercel;
2. aguardar domínio/HTTPS ficarem válidos na Vercel;
3. adicionar `meupiaget.com.br` aos Authorized Domains do Firebase Authentication;
4. configurar as variáveis Vercel recomendadas;
5. fazer deploy e regressão;
6. só depois ativar as Firestore Rules restritivas.

- RC2.7.9: removidos rewrites condicionais de `/` e `/index.html`; adicionados redirects condicionais por host e fallbacks client-side para o domínio familiar.
