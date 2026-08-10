# Guia rápido — RC2.7.15: Meu Piaget sem tocar no acesso da equipe

## Objetivo

Corrigir somente a avaliação das Firestore Rules para o responsável, preservando o caminho de autenticação da Gestão/Secretaria que já está funcionando no piloto.

## O que mudou

- `staffActive()` recebeu apenas uma guarda por claim: tokens com `role = responsavel` não executam consultas de `usuarios_auth` nem dos quatro perfis internos.
- Para tokens da equipe, a lógica permanece igual à RC2.7.14: `usuarios_auth` como caminho principal + fallback de `lucas`, `daniele`, `evanda` e `ruan` por UID/e-mail.
- `familias_auth`, Custom Token, login da equipe, bootstrap da equipe, checkout, InfinitePay e Marco Zero não foram alterados funcionalmente.

## Publicação

1. Publicar o pacote RC2.7.15 na Vercel se quiser manter o número de versão sincronizado.
2. No Firebase Console, substituir as Firestore Rules pelo conteúdo de `FIRESTORE-RULES-PARA-COLAR.txt`.
3. Publicar as Rules.
4. Primeiro confirmar que a Secretaria continua entrando e carregando Vendas.
5. Confirmar Gestão.
6. Testar o responsável no Meu Piaget.

## Critério de aprovação

- Secretaria continua operacional.
- Gestão continua operacional.
- Responsável passa da validação de sessão e consegue ler `configuracoes/sistema` e carregar sua família.

## Marco Zero

Só revisar/executar o Marco Zero depois dos três acessos passarem na mesma publicação. O corte continua em 10/08/2026 00:00 (America/Fortaleza), preservando as operações dessa data em diante.
