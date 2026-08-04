# Changelog — V1.5.0 RC1.2

## Checkout

- Todos os pagamentos externos passam por uma etapa reutilizável de conferência dos dados do comprador.
- Dados completos aparecem em resumo compacto com a ação **Alterar**.
- Dados incompletos bloqueiam o avanço até nome, telefone e e-mail serem válidos.
- Alterações são salvas no cadastro único do comprador.
- Pedidos integralmente cobertos pelo saldo continuam no fluxo interno, sem InfinitePay.
- Cada ação explícita de pagamento cria uma tentativa nova.
- Cobranças anteriores da mesma operação são marcadas como substituídas e deixam de ser reutilizadas.
- URLs vencidas, descartadas ou inválidas não são reaproveitadas.
- O endereço devolvido pela InfinitePay precisa usar HTTPS e um domínio autorizado.
- Foram adicionados registros de duração, resposta HTTP, versão e estado da criação do link.

## Programação de lanches

- Entrega cancelada passa ao estado final `cancelado_responsavel` e não exibe novas ações.
- Cancelamento devolve o valor à conta e libera o estoque.
- Remarcação mantém a ocorrência anterior como `remarcado`.
- A nova data cria uma ocorrência própria, vinculada à anterior.
- O estoque é movido da data antiga para a nova na mesma transação.
- Datas iguais, finais de semana, dias sem aula, duplicidades e estoque insuficiente são bloqueados com mensagens operacionais.

## Interface

- Criado componente global para confirmação, aviso, erro e solicitação de motivo.
- Removidos os usos visíveis de `alert()`, `confirm()` e `prompt()` do navegador.
- A área **Adicionar crédito** não repete permanentemente os campos do comprador.
- O formulário do comprador aparece apenas quando existe pagamento externo.
