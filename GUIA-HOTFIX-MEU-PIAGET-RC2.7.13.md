# Guia rápido — Hotfix Meu Piaget RC2.7.13

## Objetivo

Corrigir o erro `Missing or insufficient permissions` que aparece depois que CPF e senha do responsável já foram aceitos.

## Publicação

1. Publicar o pacote RC2.7.13 na Vercel, mantendo as mesmas variáveis de ambiente.
2. Publicar no Firebase as Rules contidas em `firestore.rules` ou, de forma equivalente, em `FIRESTORE-RULES-PARA-COLAR.txt`.
3. Não alterar DNS, domínio, InfinitePay ou variáveis de checkout.
4. Não executar o Marco Zero ainda.

## Teste mínimo

- Abrir `https://meupiaget.com.br`.
- Entrar com o CPF/senha já usados no teste anterior.
- Confirmar carregamento da página inicial, alunos, saldo e navegação básica.
- Sair e entrar novamente.
- Repetir em PC e celular.
- Entrar também em Gestão e Secretaria para garantir que o espelho `usuarios_auth` permaneceu funcional.

## Resultado esperado

Ao fazer login, o backend cria `sessoes_meu_piaget` e `familias_auth`, emite o Custom Token e o navegador executa um probe antes de consultar o Firestore.

Se houver desencontro de versão entre backend e Rules, a mensagem passa a ser específica, indicando a publicação das Firestore Rules da RC2.7.13.
