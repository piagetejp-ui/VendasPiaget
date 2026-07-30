# Escola Piaget — Sistema de Vendas, Cantina e Atendimento
## V1.3.4 — Notificações e Auditoria Humanizada

Esta versão parte da V1.3.3 e adiciona duas camadas operacionais importantes:

1. **Central de notificações**, para mostrar o que exige ação da secretaria, cantina ou gestão.
2. **Auditoria humanizada**, para transformar registros técnicos em uma linha do tempo legível.

## Arquivos principais

- `index.html` — aplicação principal.
- `obrigado.html` — página de retorno/obrigado.
- `assets/` — identidade visual da Escola Piaget.
- `firestore.rules.v1.3.draft` — rascunho de regras da versão de acesso.
- `CHANGELOG.md` — resumo das mudanças.

## Como atualizar

1. Suba a pasta completa da V1.3.4 para o deploy.
2. Não apague o Firestore.
3. Não reinicialize alunos, contas ou produtos.
4. Abra o sistema com `Ctrl + F5`.
5. Entre com um perfil interno e verifique o sino de notificações no topo.

## Teste sugerido

### Teste de notificação de reset
1. Entre no portal do responsável.
2. Use matrícula + senha incorreta ou clique em **Esqueci minha senha**.
3. Solicite novo acesso.
4. Entre como Lucas ou secretaria.
5. Verifique o sino de notificações.
6. Abra a notificação e gere o link temporário.
7. Confirme que a notificação relacionada foi resolvida.

### Teste de auditoria
1. Acesse **Auditoria**.
2. Confirme que ações aparecem em linguagem humana.
3. Use os filtros de categoria e severidade.
4. Abra **Detalhes** para conferir o JSON técnico.

## Coleções novas ou reforçadas

### `notificacoes`
Registra ações que exigem atenção.

Campos principais:
- `tipo`;
- `titulo`;
- `mensagem`;
- `prioridade`;
- `status`;
- `destinatariosPerfis`;
- `destinatariosUsuarios`;
- `alunoId`;
- `caixaId`;
- `vendaId`;
- `pedidoId`;
- `resetId`;
- `requestId`;
- `acaoPrincipal`;
- `criadoEm`;
- `lidoPor`;
- `resolvidoEm`;
- `resolvidoPorNome`.

### `historico_auditoria`
Mantém compatibilidade com os campos antigos e adiciona campos de leitura humana:
- `acaoTecnica`;
- `tituloHumano`;
- `descricaoHumana`;
- `categoria`;
- `severidade`;
- `icone`;
- `usuarioPerfil`.

## Próximo passo recomendado

Depois de validar as notificações e a auditoria, o próximo bloco recomendado é iniciar a configuração do checkout InfinitePay, já com origem, usuário, venda, aluno e status bem amarrados ao sistema.
