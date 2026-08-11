# Validação local/estática — RC2.7.26

Data: 11/08/2026
Base: **RC2.7.25 publicada**

## Escopo
Esta release altera apenas o fluxo de **Cancelar / Estornar** e a forma segura de tratar uma ocorrência da Cantina que esteja com status `entregue` por erro operacional.

## Resultado
**Aprovada para deploy e smoke test real.**

### Estrutura e sintaxe
- 54 arquivos JavaScript verificados com `node --check`.
- 0 erros de sintaxe.
- 10 arquivos físicos em `/api` — permanece abaixo do limite de 12 funções observado no Vercel Hobby.
- 92 referências locais de HTML conferidas; 0 arquivos ausentes.
- 48 `require()` relativos conferidos; 0 módulos locais ausentes.
- 17 URLs `/api/...` usadas no frontend conferidas; todas resolvem para função física ou rewrite válido.
- Release ativa referenciada pelos HTMLs/service worker: `1.6.0-rc2.7.26`.

### Firestore / infraestrutura preservada
- `firestore.rules` byte a byte igual à RC2.7.25.
- SHA-256: `a38abddf0e715f771cea18b8fdf4f1af94d6d4e4d82686480b66c7232c14f11b`.
- Nenhuma nova função serverless criada.
- Consolidação `/api/operacoes` preservada.
- Webhook/InfinitePay não alterado.
- Marco Zero não alterado.

### Cancelamento / entrega
Validação estrutural confirmou:
- o modal consulta `ocorrencias_entrega` por `vendaId` somente quando o cancelamento/reembolso é aberto;
- ocorrência `entregue` continua bloqueada por padrão;
- ocorrência `entregue` é permitida somente quando seu ID está em `entregasMarcadasPorEnganoIds` e existe confirmação explícita;
- teste unitário isolado do bloqueador: `entregue` sem autorização = bloqueia; `entregue` explicitamente selecionada = permite; `aluno_ausente` continua bloqueando;
- a seleção é revalidada novamente dentro da transação, evitando corrida entre abertura do modal e confirmação;
- a ocorrência corrigida preserva o histórico de `entregueEm` e grava metadados de reversão;
- a venda grava IDs/quantidade das entregas corrigidas;
- auditoria específica `entrega_marcada_por_engano_revertida` é gerada;
- notificação de correção é prevista para equipe/responsável;
- o mesmo tratamento está disponível no cancelamento sem recebimento e no cancelamento com reembolso.

### Segurança operacional mantida
- Se uma venda tiver entrega efetivamente realizada, o operador não deve marcá-la como erro. Sem selecionar todas as ocorrências `entregue`, o cancelamento integral é bloqueado.
- `aluno_ausente`, `nao_entregue` e outros estados finais que podem já ter movimentado crédito/capacidade continuam bloqueados.
- Esta release **não** implementa cancelamento parcial de uma venda com consumo real.

### UX
- Acionadores `Cancelar / Estornar` passaram de vermelho sólido para alerta discreto com borda.
- Primeiro modal e opções de caminho financeiro usam fundo neutro.
- Botão final destrutivo usa vermelho suave e texto escuro de alto contraste.
- Confirmação final usa diálogo neutro, não o modo `danger` vermelho.
- Vermelho forte permanece para mensagens de erro real/status cancelado.

## Limites desta validação
Não foram executados:
- deploy real na Vercel;
- transação contra Firestore de produção;
- cancelamento de uma venda real;
- notificação real;
- validação visual em navegador/dispositivo real.

Esses itens pertencem ao smoke test pós-deploy.
