# Sistema de Vendas Escola Piaget — V1.2.1

Versão incremental sobre a V1.2.0. Não exige apagar o Firestore, reinicializar alunos nem perder vendas, contas ou pedidos existentes.

## Alterações principais

### 1. Identidade visual nos documentos
- Relatório da conta da cantina em PDF A4 com assinatura visual oficial da Escola Piaget.
- Imagem para WhatsApp com logotipo completo em tamanho legível.
- Comprovante de venda com identidade visual.
- Relatório de fechamento de caixa com identidade visual.
- Páginas de continuação usam o símbolo simples para manter legibilidade.

Regra aplicada:
- espaços compactos da interface: símbolo simples;
- peças institucionais e documentos: logotipo completo em tamanho legível, sem repetir “Escola Piaget” ao lado.

### 2. Gestão consolidada de caixas
O perfil de gestão passa a ver todos os caixas da data selecionada, incluindo:
- cantina e secretaria;
- manhã e tarde;
- situação aberto/fechado;
- operador de abertura;
- vendas em dinheiro;
- saldo esperado;
- saldo contado;
- diferença;
- responsável pelo fechamento;
- data e hora;
- justificativa de divergência;
- movimentação completa.

### 3. Fechamento auditável
Ao fechar um caixa:
- o sistema mostra esperado, contado e diferença;
- divergência diferente de zero exige justificativa;
- fechamento exige confirmação do responsável;
- grava nome do perfil, identificador e horário;
- cria snapshot na coleção `fechamentos_caixa`;
- registra auditoria.

### 4. Comunicação entre cantina e secretaria
Ao fechar o caixa da cantina:
- registra saída de retorno para a secretaria;
- se o caixa correspondente da secretaria estiver aberto, cria a entrada espelhada;
- se não estiver aberto, cria registro em `transferencias_caixa` com status `pendente_recebimento`;
- ao abrir o caixa correspondente da secretaria, os retornos pendentes do mesmo turno são recebidos automaticamente e passam a compor a movimentação do caixa.

## Observação de segurança
A “assinatura operacional” desta versão registra o perfil provisório selecionado no sistema, nome e horário. Como o projeto ainda está sem Firebase Authentication, isso não é uma assinatura digital criptográfica nem prova forte de identidade. Quando Authentication for ativado, o mesmo fluxo poderá ser vinculado ao usuário autenticado.

## Atualização
Envie a pasta completa para a Vercel e faça novo deploy. Não apague o Firestore.

Arquivos importantes:
- `index.html`
- `obrigado.html`
- `assets/`
