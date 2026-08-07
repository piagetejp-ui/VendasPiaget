# Validação técnica — 1.6.0-rc2.7.1-vercel-hobby-hotfix

- 10 arquivos JavaScript diretamente em `/api` (abaixo do limite de 12 informado pela Vercel Hobby).
- 6 rewrites de compatibilidade no `vercel.json`.
- Helpers compartilhados em `/server`.
- Sintaxe JavaScript validada com `node --check` em `/api`, `/server` e release frontend.
- `index.html`, `equipe.html`, `meu-piaget.html`, `pagamento.html` e `obrigado.html` sem referências locais ausentes.
- Única pasta física de release: `releases/1.6.0-rc2.7.1-vercel-hobby-hotfix/`.
- `version.json`, `package.json`, service worker e HTMLs alinhados à RC2.7.1.

Observação: o runtime local não possui `firebase-admin` instalado, portanto a validação executada aqui é estrutural/sintática; o bundle real da Vercel instalará a dependência declarada em `package.json`.
