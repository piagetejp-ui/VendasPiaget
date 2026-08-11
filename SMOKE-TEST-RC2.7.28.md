# Smoke test pós-deploy — RC2.7.28

Execute somente depois de a Vercel mostrar o deployment como **Ready**.

## 1. Acesso geral
- [ ] Gestão abre normalmente.
- [ ] Secretaria abre normalmente.
- [ ] Cantina abre normalmente.
- [ ] Meu Piaget permite login de uma família válida.
- [ ] Catálogo/dashboard básicos continuam carregando.

## 2. Venda presencial de fardamento — regressão `nome`
Use uma variação de farda realmente disponível para o teste.
- [ ] Secretaria → nova venda presencial.
- [ ] Selecionar aluno.
- [ ] Adicionar Camisa de farda, tamanho/modelo válidos.
- [ ] Escolher uma forma de pagamento apropriada ao teste.
- [ ] Avançar até Confirmação.
- [ ] Confirmar operação.
- [ ] Não aparece `nome is not defined`.
- [ ] Venda é criada uma única vez.
- [ ] Pedido/reserva de farda aparece corretamente.
- [ ] Estoque/reserva da variação reflete a venda.
- [ ] Movimentação financeira correspondente aparece.

## 3. Cancelar / Estornar — regressão `detalhes`
Preferir uma venda de teste ou um caso real que de fato precise ser corrigido.
- [ ] Abrir Cancelar / Estornar.
- [ ] Informar motivo e observação.
- [ ] Se houver entrega marcada por engano, selecionar explicitamente a ocorrência correta.
- [ ] Confirmar a operação.
- [ ] Não aparece `detalhes is not defined`.
- [ ] Venda passa para cancelada.
- [ ] Conta familiar e movimentos ficam coerentes.
- [ ] Entrega marcada por engano fica cancelada/corrigida quando selecionada.
- [ ] Estoque/capacidade/pedido são revertidos conforme o caso.
- [ ] Auditoria registra o cancelamento e, quando aplicável, a correção da entrega.

## 4. Meu Piaget — permissões e histórico
Entrar com um responsável que tenha histórico real.

### Tela inicial
- [ ] Página principal abre sem bloco de `Missing or insufficient permissions`.
- [ ] Avisos/pagamentos pendentes carregam.

### Movimentações
- [ ] Abrir Movimentações.
- [ ] Primeira página carrega.
- [ ] Se houver botão de carregar mais, carregar outra página.
- [ ] Em família com irmãos, os registros permanecem vinculados ao aluno correto.
- [ ] Nenhum `Missing or insufficient permissions` aparece.

### Pedidos e programação
- [ ] Abrir Pedidos da família.
- [ ] Conferir ao menos um pedido, se houver.
- [ ] Abrir Programação de lanches, se houver programação ativa.
- [ ] Dados são somente da família logada.

### Pagamentos pendentes
- [ ] Abrir Pagamentos pendentes.
- [ ] Conferir que links/cobranças pertencem à família.
- [ ] Iniciar um fluxo de pagamento até a etapa anterior à cobrança, se necessário, e confirmar que a checagem de duplicidade não falha por permissão.

### Notificações
- [ ] Abrir sino/painel de Notificações.
- [ ] Abrir o detalhe de uma notificação.
- [ ] Marcar uma como lida.
- [ ] Marcar todas como lidas, se apropriado.
- [ ] Reabrir o painel e confirmar que o estado de leitura foi preservado.
- [ ] Nenhum `Missing or insufficient permissions` aparece.

## 5. Segurança
- [ ] Fazer login com outra família e confirmar que ela não enxerga movimentos, pedidos ou notificações da família usada no teste anterior.
- [ ] Não republicar `firestore.rules` para esta release.

## 6. Vercel
Durante os testes, observar logs de runtime:
- [ ] `/api/familias?modulo=dados` responde 200 para leituras válidas.
- [ ] `/api/registrar-operacao-presencial` não registra `nome is not defined`.
- [ ] Não há HTTP 500 novo nos fluxos acima.

Se algum item falhar, registrar: horário aproximado, aluno/família usada, tela, ação executada e print/log correspondente antes de repetir várias vezes a operação.
