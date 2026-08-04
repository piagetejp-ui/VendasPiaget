# Validação técnica — V1.6.0 RC2

## Resultado local

- Sintaxe validada em todos os módulos JavaScript do frontend.
- Sintaxe validada em todas as APIs serverless.
- Todos os módulos frontend carregados no mesmo contexto de execução.
- Todas as APIs carregadas como módulos Node com `firebase-admin` simulado.
- 455 handlers inline verificados; nenhum aponta para função ausente.
- Caminhos locais de CSS, JavaScript e imagens conferidos.
- Arquivos do service worker conferidos, incluindo o novo módulo do catálogo.
- JavaScript embutido em `pagamento.html` e `obrigado.html` validado.

## Casos simulados

- Produto simples com estoque geral.
- Combo consumindo componente.
- Evento consumindo capacidade de vagas.
- Mensalidade com competência obrigatória.
- Negociação com referência obrigatória.
- Venda presencial usando crédito parcial do aluno.
- Regularização presencial de saldo negativo.
- Geração de link online com total recalculado no servidor.
- Dados válidos do comprador aceitos pela página pública.
- Renderização do Catálogo de vendas e do carrinho unificado.

## Regras estruturais verificadas

- IDs permanentes para categorias e itens.
- Categorias inativas retiram seus itens das novas vendas.
- Canal presencial e online verificado no servidor.
- Combos possuem detecção de composição circular no servidor.
- Estoque e vagas são lidos antes das gravações nas transações.
- Movimentos financeiros e vendas armazenam fotografia dos itens utilizados.
- Migração inicial marcada para não duplicar o catálogo.
- Mudança de tipo inativa o cadastro legado incompatível.

## Limites da validação local

Ainda exigem teste após o deploy:

- Firestore real e suas regras de segurança.
- Firebase Auth real.
- InfinitePay real.
- concorrência simultânea de duas vendas sobre o mesmo estoque;
- comportamento em iPhone e Android reais;
- migração com os dados atualmente existentes no projeto.

A versão é uma candidata estrutural de desenvolvimento, não uma declaração de produção final.
