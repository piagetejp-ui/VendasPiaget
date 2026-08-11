# Smoke Test — RC2.7.27

## 1. Deploy
- Confirmar `Ready` na Vercel.
- Confirmar que a release mostra `1.6.0-rc2.7.27`.
- Confirmar que continuam existindo somente 10 funções físicas em `/api`.
- **Não republicar Firestore Rules.**

## 2. Edição do responsável oficial pela escola
Em **Gestão ou Secretaria → Alunos/Contas → abrir a Conta familiar → Resumo**:
1. Confirmar que aparece **Editar responsável**.
2. Alterar, de preferência em um cadastro de teste/controlado, telefone ou e-mail do responsável oficial.
3. Salvar e reabrir a conta.
4. Confirmar que o cadastro oficial foi atualizado para os alunos vinculados.
5. Abrir **Editar comprador padrão** e confirmar que os dados do comprador não foram modificados automaticamente pela edição do responsável.
6. Conferir Auditoria: evento `responsavel_financeiro_editado` com antes/depois.

## 3. Edição do comprador padrão pela escola
Na mesma Conta familiar:
1. Abrir **Editar comprador padrão**.
2. Alterar nome, telefone ou e-mail do pagador usado nos próximos checkouts.
3. Salvar.
4. Reabrir o editor e confirmar persistência.
5. Se a família tiver mais de um aluno, conferir que o mesmo comprador padrão aparece ao iniciar pagamento para outro filho.
6. Confirmar que o nome/e-mail do responsável financeiro oficial não mudou.
7. Confirmar que comprovantes/pagamentos antigos continuam com os snapshots históricos originais.
8. Conferir Auditoria: `dados_comprador_editados_pela_escola`.

## 4. Autorização administrativa pré-existente
Escolher um aluno cuja família ainda não tenha assumido o controle pelo Meu Piaget:
1. Em **Autorização de consumo por aluno**, marcar **Autorizar geração de saldo devedor**.
2. Definir um limite individual pequeno e controlado, por exemplo R$ 10,00.
3. Selecionar **Condição pré-existente à implantação** ou **Autorização administrativa** conforme o caso real.
4. Salvar.
5. Na Cantina, fazer uma compra sem saldo abaixo do limite.
6. Confirmar que a compra é aceita mesmo se o limite familiar anterior estiver zerado.
7. Tentar uma compra que faça a dívida total ultrapassar o limite individual e confirmar que é bloqueada.
8. Conferir venda/movimento: `origemAutorizacaoConsumo` administrativa e `limiteEfetivoCentavos` corretos.

## 5. Responsável assume o controle
Para a mesma família:
1. Entrar no Meu Piaget.
2. Abrir **Autorizações e limite**.
3. Alterar e salvar a autorização/limite familiar.
4. Voltar à Gestão/Secretaria e reabrir **Autorização de consumo por aluno**.
5. Confirmar que a origem atual aparece como **Responsável assumiu o controle**.
6. Na Cantina, confirmar que a regra usada agora é a familiar e não a autorização administrativa anterior.
7. Na Gestão/Secretaria, abrir novamente a autorização desse aluno e confirmar que aparece **Controle do responsável** em modo de consulta, sem botão para substituir por nova autorização administrativa.
8. Conferir Auditoria: `preferencias_financeiras_responsavel_atualizadas`, incluindo a quantidade/lista de regras administrativas substituídas quando existiam.

## 6. Caso de cache aberto na Cantina
- Deixar a tela da Cantina aberta antes de o responsável alterar o limite.
- O responsável altera a autorização no Meu Piaget.
- Sem recarregar toda a aplicação da Cantina, tentar uma nova compra sem saldo.
- A transação deve consultar o aluno atual e obedecer a nova origem `responsavel`, não a regra administrativa que estava no cache da tela.

## 7. Regressão curta
Confirmar rapidamente:
- Catálogo abre e vende normalmente;
- Vendas e Cobranças abrem;
- Cancelar / Estornar da RC2.7.26 continua visível e funcional;
- Pedidos/Cantina abre;
- Dashboard e Auditoria abrem;
- Meu Piaget continua acessível;
- checkout/InfinitePay gera link normalmente;
- nenhum dado real do Marco Zero foi resetado.
