# Guia rápido — Autenticação consolidada RC2.7.14

## Objetivo

Fazer Gestão, Secretaria e Meu Piaget funcionarem simultaneamente com Firestore fechado.

## Publicação

1. Publicar o pacote RC2.7.14 na Vercel, mantendo as mesmas variáveis de ambiente.
2. No Firebase Console, substituir as Firestore Rules pelo conteúdo de `FIRESTORE-RULES-PARA-COLAR.txt`.
3. Publicar as Rules.
4. Abrir uma nova sessão do portal da equipe e testar Gestão.
5. Testar Secretaria.
6. Testar o mesmo responsável usado no teste anterior do Meu Piaget.

## Resultado esperado

- Gestão entra e carrega dados.
- Secretaria entra e carrega Vendas.
- Responsável entra por CPF + senha e carrega sua família.
- Nenhum perfil recebe `Missing or insufficient permissions` no fluxo normal.

## Se um dos três falhar

Não executar o Marco Zero. Registrar qual perfil falhou, em qual tela e a mensagem exibida. A RC2.7.14 mantém os dois trilhos de autorização separados para permitir diagnóstico sem alternar regras entre equipe e família.

## Marco Zero

Depois dos três acessos passarem na mesma implantação, abrir Configurações → Meu Piaget e implantação → revisar o corte. O corte continua em 10/08/2026 00:00 (America/Fortaleza), preservando todas as operações dessa data em diante.
