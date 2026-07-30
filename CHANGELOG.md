# Escola Piaget — Sistema de Vendas
## V1.3.4 — Notificações e Auditoria Humanizada

Data: 30/07/2026

## Entregas principais

### 1. Central de notificações
- Adicionado sino de notificações no topo do sistema.
- Adicionada página própria **Notificações** no menu dos perfis internos.
- Notificações filtradas por perfil: administração/gestão, secretaria e cantina.
- Filtros por status, prioridade e busca textual.
- Ações diretas nas notificações, como abrir acesso do responsável, caixas, fardas e configurações.

### 2. Solicitação de reset do responsável
- Quando o responsável clica em **Esqueci minha senha**, o sistema agora cria:
  - solicitação em `solicitacoes_reset_responsavel`;
  - notificação para secretaria/gestão;
  - auditoria humanizada.
- Quando a secretaria/gestão gera o link temporário, as notificações relacionadas são marcadas como resolvidas.
- As solicitações abertas do mesmo aluno são marcadas como `link_gerado`.

### 3. Auditoria humanizada
- A página de auditoria foi redesenhada como linha do tempo.
- Ações técnicas, como `link_reset_responsavel_gerado`, passaram a aparecer em linguagem humana.
- Adicionados filtros por categoria, severidade e busca.
- Adicionado botão **Detalhes** com a leitura humana e o JSON técnico para conferência gerencial.

### 4. Auditoria enriquecida
Novos registros de auditoria gravam campos como:
- `tituloHumano`;
- `descricaoHumana`;
- `categoria`;
- `severidade`;
- `icone`;
- `usuarioPerfil`;
- vínculos com aluno, caixa, venda, pedido ou reset quando disponíveis.

### 5. Notificações geradas automaticamente
Nesta versão, os seguintes eventos passam a criar notificações:
- solicitação de reset de senha do responsável;
- link temporário de reset gerado;
- fechamento de caixa com divergência;
- novo pedido de farda;
- alterações sensíveis em perfil, produto, preço ou configuração.

## O que não foi alterado
- Checkout InfinitePay ainda não foi configurado nesta versão.
- Fluxos de venda, caixa, estoque e farda foram preservados.
- Regras do Firestore não foram substituídas automaticamente.
- Authentication interno continua conforme V1.3.0–V1.3.3.

## Observação
A V1.3.4 é incremental. Não é necessário apagar dados do Firestore nem reinicializar a base.
