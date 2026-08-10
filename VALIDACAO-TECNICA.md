# Validação técnica — 1.6.0-rc2.7.14

## Escopo

RC2.7.14 foi derivada diretamente da RC2.7.13. A mudança funcional desta candidata está concentrada nas Firestore Rules para consolidar, na mesma publicação, os dois trilhos de autenticação:

1. equipe por Firebase Authentication + `usuarios_auth`;
2. fallback de piloto por `usuarios_acesso` para os perfis internos já conhecidos;
3. família por Custom Token + `familias_auth/{sessionId}`;
4. leitura segura de claims opcionais com `request.auth.token.get(..., padrão)`;
5. remoção da dependência de `!isFamily()` no reconhecimento da equipe.

O backend e o frontend de autenticação familiar da RC2.7.13 foram preservados funcionalmente, assim como Marco Zero por data e logo simples nos PDFs.

## Validações estáticas executadas

- `node --check` nos 24 JavaScript da release ativa;
- `node --check` nas 10 funções `/api`;
- `node --check` nos 10 módulos `/server`;
- `node --check` no `sw.js`;
- parse dos 4 JSONs ativos;
- verificação de 86 referências locais dos HTMLs, sem referência ausente;
- HTMLs, Vercel e service worker apontando para `releases/1.6.0-rc2.7.14/`;
- somente uma pasta dentro de `releases/`;
- pacote com 89 arquivos, abaixo do limite de 100 arquivos que vinha bloqueando a subida pela interface do GitHub;
- igualdade entre `firestore.rules`, `FIRESTORE-RULES-PARA-COLAR.txt` e `FIRESTORE-RULES-RC2.7.14-AUTENTICACAO-CONSOLIDADA.txt`;
- ausência de `allow read, write: if true`;
- presença simultânea de `familias_auth` e `usuarios_auth`;
- presença do fallback `staffKnownProfile()` para `lucas`, `daniele`, `evanda` e `ruan`;
- confirmação de que `staffMirrorExists()` não depende de `!isFamily()`;
- comparação de `_family-utils.js`, `handler-acesso-meu-piaget.js`, `handler-security.js`, `05-auth.js` e `20-family-implantation.js` contra a RC2.7.13: sem alteração funcional além do número da versão.

## Teste obrigatório publicado

Depois de publicar **aplicação + Firestore Rules da RC2.7.14** na mesma implantação:

1. Gestão: entrar e carregar o Resumo;
2. Secretaria: entrar e abrir Vendas;
3. Meu Piaget: entrar com CPF + senha e carregar a família;
4. repetir o Meu Piaget no celular se necessário;
5. somente se os três perfis passarem, voltar à revisão do Marco Zero.

## Limite da validação local

Não houve conexão desta geração com o Firestore publicado, compilação das Rules pelo Firebase nem deploy. A validação definitiva é o teste na implantação real.

## Deploy

Este pacote foi apenas gerado e validado localmente. Nenhum deploy é afirmado por esta documentação.
