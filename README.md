# Escola Piaget — Sistema de Vendas V1.5.0-dev3-clean

Esta versão é uma reconstrução limpa da V1.5.0-dev2, preservando os fluxos já validados e eliminando o encadeamento de páginas antigas do responsável.

## O que mudou na arquitetura

- `index.html` contém apenas a estrutura visual e referências aos arquivos estáticos.
- O JavaScript foi separado por domínio em `js/`.
- Existe **uma única função oficial `renderParentPortal()`**.
- Existe **uma única inicialização**, em `js/11-bootstrap.js`.
- Existe **um único roteador interno**, com permissões e notificações.
- Login por senha, primeiro acesso, sessão salva e retorno do checkout chamam o mesmo portal.
- Foram removidos os renderizadores históricos V132, V141, V142, V143 e V150 do fluxo do responsável.
- A versão não faz gravações atrasadas de configuração apenas para marcar número de versão.

## Funcionalidades preservadas

- Firebase Authentication da equipe.
- Login e senha do responsável, primeiro acesso e redefinição por link temporário.
- Conta corrente única do aluno.
- Crédito, saldo em aberto, limite e bloqueio semanal.
- Checkout InfinitePay e página `obrigado.html`.
- Pedidos de cantina por dia, semana e mês, com reserva de 5 minutos.
- Pedido principal com entregas diárias detalhadas.
- Compra de fardamento pelo responsável.
- Agenda da cantina, calendário e pendências.
- Venda presencial da secretaria, troco devolvido ou convertido em crédito.
- Produtos separados entre Cantina, Combos, Fardas/Fábrica e Inativos.
- Caixa por sessões, notificações e auditoria.
- Menu lateral no celular.

## Estrutura

```text
index.html
css/app.css
js/01-core.js
js/02-operations.js
js/03-cash.js
js/04-brand.js
js/05-auth.js
js/06-notifications-navigation.js
js/07-account-checkout.js
js/08-orders-agenda.js
js/09-portal-sales.js
js/11-bootstrap.js
api/*.js
obrigado.html
package.json
```

## Aplicação

Mantenha a pasta `assets/` já existente no projeto, pois as logos continuam sendo carregadas desse diretório.

Publique primeiro em Preview na Vercel e execute o `TESTES.md` antes de promover para produção.
