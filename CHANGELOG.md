# Escola Piaget — Sistema de Vendas
## V1.3.2 — Correção do acesso do responsável após reset

### Correções
- Corrigida a falha em que a senha do responsável era redefinida, o topo indicava login do responsável, mas o portal do aluno não era renderizado.
- Causa auditada: o patch V1.3.0 capturava `window.renderParentPortal` no mesmo bloco em que declarava uma nova função `renderParentPortal()`. Por hoisting do JavaScript, a referência podia apontar para a própria função, gerando recursão e impedindo a troca de tela.
- A V1.3.2 substitui a renderização do portal do responsável por uma função autônoma, sem depender dos wrappers anteriores.
- O login por senha, o primeiro acesso e o reset por link agora chamam a mesma abertura de sessão do responsável.
- Matrículas digitadas com espaços, pontos ou hífens continuam sendo normalizadas.

### Mantido
- Login interno por Firebase Authentication.
- Perfis e permissões da equipe.
- Link temporário de reset com validade de 2 horas e uso único.
- Auditoria de criação/redefinição de senha.
- Regras operacionais de vendas, caixa, estoque e relatórios.
