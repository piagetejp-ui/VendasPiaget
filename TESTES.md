# Testes — RC2.7.11

## 1. Teste prioritário do aviso de Caixa em Vendas

Com o Caixa da Secretaria fechado:

1. abrir **Vendas** e confirmar o aviso **Caixa da Secretaria fechado**;
2. clicar em **Venda presencial**;
3. não registrar nada;
4. fechar/cancelar a venda pelo X;
5. confirmar que, ao retornar para Vendas, o aviso continua visível;
6. repetir a abertura/fechamento mais de uma vez;
7. confirmar que Pix, cartão e saldo continuam disponíveis e Dinheiro permanece indisponível.

Depois abrir o Caixa e confirmar que o aviso muda para o estado real. Fechar o Caixa novamente e confirmar nova atualização.

## 2. Status da conta no Meu Piaget

Testar três situações:

- saldo igual ou maior que zero → **Regular**;
- saldo negativo → **Pendente**;
- saldo negativo + bloqueio semanal/manual/limite → **Pendente** + indicação separada **Conta bloqueada**.

O cabeçalho da conta não deve usar `Confirmado`, `Aguardando pagamento` ou `Cancelado` como situação financeira global.

## 3. Relatórios das páginas

### Vendas
- emitir em **Todas**, **Presenciais**, **Online**, **Pendentes** e **Concluídas**;
- conferir se o título do filtro e as linhas correspondem ao recorte atual;
- conferir total e quantidade.

### Cobranças
- emitir em **Saldo em aberto**, **Contas bloqueadas**, **Links pendentes**, **Pagos recentes** e **Mostrar todas**;
- conferir valor e situação.

### Caixa
- Gestão: testar visão por ano, mês e dia;
- Secretaria: testar visão do dia permitida ao perfil;
- conferir sessões, entradas, saídas e movimentos;
- abrir o detalhe de uma sessão e testar **Baixar fechamento em PDF**.

### Pedidos
- aplicar categoria, situação, indicador rápido e busca;
- emitir PDF e confirmar que somente os cards/linhas visíveis aparecem.

### Alunos e Contas
- emitir sem busca;
- pesquisar um aluno/nome/matrícula e emitir novamente;
- família com irmãos deve aparecer como uma única conta financeira;
- situação deve ser **Regular/Pendente**, com bloqueio em coluna separada.

### Movimentações
- Equipe: abrir uma conta familiar → Movimentações → emitir com **Todos os alunos** e depois com um aluno específico;
- Meu Piaget: repetir o teste no extrato familiar;
- confirmar ausência de duplicidade visual de uma mesma operação econômica.

## 4. Documentos individuais

Gerar e conferir visualmente:

1. **Comprovante de Venda**;
2. **Comprovante de Pagamento**;
3. **Fechamento de Caixa**;
4. **Demonstrativo de Valores em Aberto**;
5. **Comunicado de Regularização**;
6. **Primeiro Acesso ao Meu Piaget**.

Em todos, conferir:

- logo oficial nítida e sem distorção;
- paleta azul/laranja da Escola Piaget;
- texto sem corte/sobreposição;
- valores e identificadores corretos;
- paginação quando houver mais de uma página;
- link/QR do Meu Piaget quando aplicável.

No Primeiro Acesso, conferir: CPF completo do responsável financeiro + matrícula de qualquer aluno vinculado; depois CPF + senha criada.

## 5. Regressão curta de pagamentos — obrigatória

Como a RC2.7.10 é a base validada, confirmar após o deploy:

1. Gestão → Alunos e Contas → Gerar cobrança → link criado;
2. Meu Piaget → Regularizar → InfinitePay abre;
3. Secretaria → venda online → link interno → dados do comprador → InfinitePay;
4. Pagamentos pendentes recebe a cobrança sem duplicidade;
5. retorno pós-pagamento volta ao Meu Piaget.

## 6. Domínio

- `https://meupiaget.com.br` → Meu Piaget;
- `https://www.meupiaget.com.br` → redireciona para o domínio raiz;
- domínio técnico da Vercel → Equipe Piaget;
- `/equipe.html` no domínio familiar não deve expor a área interna.

## 7. Firestore Rules

**Não ativar ainda.** Somente depois de todos os testes acima passarem. Em seguida, usar `GUIA-ATIVACAO-SEGURANCA-RC2.7.11.md` e fazer nova regressão após publicar as Rules.
