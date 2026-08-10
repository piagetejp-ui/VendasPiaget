# Validação técnica — 1.6.0-rc2.7.13

## Escopo

RC2.7.13 foi derivada diretamente da RC2.7.12. As mudanças funcionais desta candidata estão limitadas a:

1. novo espelho de autorização familiar `familias_auth`;
2. espelho de autorização por sessão, mantendo UID Firebase estável por família;
3. Firestore Rules da família baseadas no espelho seguro;
4. inativação do espelho em logout/revogação;
5. probe de autenticação antes da primeira leitura do Firestore;
6. diagnóstico explícito quando backend e Rules publicados estiverem desencontrados;
7. atualização de versão/manifestos/documentação.

Marco Zero por data e logo simples nos PDFs foram preservados da RC2.7.12.

## Validações estáticas executadas

- `node --check` em todos os JavaScript da release ativa;
- `node --check` nas funções `/api` e módulos `/server`;
- `node --check` no `sw.js`;
- parse dos JSONs ativos;
- verificação das referências locais dos HTMLs;
- conferência de que HTMLs e service worker apontam para `releases/1.6.0-rc2.7.13/`;
- conferência de igualdade entre `firestore.rules` e `FIRESTORE-RULES-PARA-COLAR.txt`;
- inspeção estática do fluxo: sessão → espelho → Custom Token → probe → Firestore.

## Teste obrigatório publicado

Após publicar **a aplicação e as Firestore Rules da RC2.7.13**:

1. entrar no Meu Piaget com o mesmo responsável que apresentou `Missing or insufficient permissions`;
2. confirmar que o portal abre a tela inicial e carrega os alunos;
3. sair e entrar novamente;
4. testar no PC e no celular;
5. confirmar que Gestão e Secretaria continuam entrando normalmente;
6. somente depois voltar para a revisão do Marco Zero.

Se o backend estiver novo e as Rules antigas, a interface deve sinalizar a necessidade de publicar as Rules da RC2.7.13.

## Limite da validação local

Não houve conexão desta geração com o Firestore publicado nem deploy. Portanto, o sucesso definitivo do handshake depende do teste no ambiente publicado.

## Deploy

Este pacote foi apenas gerado e validado localmente. Nenhum deploy é afirmado por esta documentação.
