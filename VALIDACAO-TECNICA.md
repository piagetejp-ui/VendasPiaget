# Validação técnica — 1.5.0-rc1.3-portal-responsavel-hotfix

- Todos os arquivos JavaScript passaram por `node --check`.
- Todos os módulos frontend foram carregados em uma VM conjunta.
- Todas as APIs foram carregadas como módulos Node.
- Testes de integração cobriram: agregação de pedidos, abertura direta por notificação, remarcação, reserva vencida, conflito ativo e cancelamento.
- O ZIP foi verificado com `unzip -t`.

A validação real ainda depende do deploy com Firestore e navegador.
