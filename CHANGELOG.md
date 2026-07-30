# CHANGELOG — V1.3.1

## Correção focada

Esta versão corrige o fluxo de redefinição de senha do responsável identificado nos testes da V1.3.0.

### Ajustes realizados

- O link de redefinição agora inclui `resetId` além de `resetAluno` e `resetToken`.
- A validação do token passou a buscar o documento exato do reset quando o `resetId` existe.
- Mantida compatibilidade com links antigos da V1.3.0, que não tinham `resetId`.
- Após redefinir a senha, o sistema cria a sessão do responsável e abre imediatamente o portal do aluno.
- O login por senha passou a normalizar a matrícula, evitando falha por espaço, ponto, hífen ou formatação.
- Mensagens de erro foram melhoradas para diferenciar senha incorreta, senha inexistente e acesso temporariamente bloqueado.
- Solicitações abertas de reset do aluno são marcadas como atendidas quando o link é usado com sucesso.

### O que não foi alterado

- Checkout InfinitePay.
- Perfis internos.
- Regras do caixa.
- Estoque.
- Vendas.
- Relatórios.
- Regras Firestore.
