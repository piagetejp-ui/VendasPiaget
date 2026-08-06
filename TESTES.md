# Testes — 1.6.0-rc2.4.1-caixa-page-hotfix

## Teste prioritário após o deploy

1. Entrar como Lucas e abrir **Caixa**.
2. Repetir como Daniele.
3. Repetir como Evanda.
4. Confirmar que a página mostra o caixa aberto ou fechado, sem ficar vazia.

## Compatibilidade com caixa antigo

1. Manter um caixa aberto criado pela RC2.3.2 ou anterior.
2. Publicar a RC2.4.1.
3. Abrir a página Caixa.
4. Confirmar que o sistema cria o período de responsabilidade e mantém:
   - a mesma sessão;
   - o responsável anterior;
   - o valor inicial;
   - as movimentações existentes.

## Proteção visual

1. Simular falha de leitura do Firestore.
2. Confirmar que aparece **Erro ao carregar o caixa**.
3. Confirmar que existe o botão **Tentar novamente**.
4. Abrir Vendas e confirmar que o restante da página continua utilizável mesmo se o aviso do caixa falhar.

## Regressão rápida

- Abrir caixa.
- Conferir e assumir.
- Registrar entrada e saída.
- Fazer venda em dinheiro.
- Fechar caixa.
- Abrir Vendas e verificar o aviso antecipado do caixa.
