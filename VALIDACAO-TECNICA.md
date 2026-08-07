# Validação técnica — 1.6.0-rc2.7.6

## Resultado local

- **43** arquivos JavaScript passaram em `node --check`.
- **4** JSON foram parseados com sucesso.
- **10** funções JavaScript físicas em `/api` (mantém margem dentro do limite observado de 12 da Vercel Hobby).
- `index.html`, `equipe.html`, `meu-piaget.html`, `pagamento.html` e `obrigado.html` sem referências locais ausentes.
- Smoke HTTP local: `/`, páginas principais, `version.json` e `firestore.rules` responderam corretamente.
- Única release física: `releases/1.6.0-rc2.7.6/`.
- Nenhuma referência de runtime às releases RC2.7.0–RC2.7.5 nos HTMLs/service worker/configuração Vercel.
- `firestore.rules` sem `allow read, write: if true`; chaves e parênteses balanceados na validação estática.
- Nenhum literal de CPF completo identificado no frontend/release estática pela varredura de 11 dígitos e padrão de campo CPF.
- Nenhuma chave privada PEM/JSON de service account embarcada no pacote.
- `16-cash-responsibility.js` comparado à RC2.7.5, normalizando apenas a versão: **conteúdo funcional idêntico**.

## Segurança implementada

- login visível do responsável preservado;
- cookie familiar `HttpOnly` / `Secure` / `SameSite=Lax`;
- Firebase Custom Token técnico gerado somente pelo backend;
- sessão familiar revogável e validada também pelas Firestore Rules;
- nenhuma necessidade de cadastro manual de responsáveis no Firebase Auth;
- staff bootstrap validado server-side antes da primeira leitura Firestore da equipe;
- `usuarios_auth` escrito/sincronizado pelo Admin SDK no fluxo de administração;
- conta financeira somente leitura para o navegador do responsável;
- autorização/limite recalculados pela API;
- rate limit persistente nos endpoints de login/primeiro acesso/reset;
- sessão antiga em `localStorage` aceita apenas como ponte de migração e removida no novo runtime.

## Limite da validação local

O ambiente de construção não possui Firebase CLI/Emulator + credenciais do projeto real para executar a avaliação semântica oficial das Security Rules e os fluxos reais de Firebase/InfinitePay. Por isso:

1. publicar primeiro o código RC2.7.6 mantendo temporariamente as Rules atuais;
2. executar o smoke test de Equipe + Meu Piaget;
3. publicar `firestore.rules` no Firebase Console;
4. executar a bateria pós-Rules do `GUIA-ATIVACAO-SEGURANCA-RC2.7.6.md` antes do piloto amplo.
