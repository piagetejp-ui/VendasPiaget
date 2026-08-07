# Validação técnica — 1.6.0-rc2.7.2-familia-compartilhada

- **10** arquivos JavaScript diretamente em `/api` (abaixo do limite observado de 12 da Vercel Hobby).
- Única pasta física de release: `releases/1.6.0-rc2.7.2-familia-compartilhada/`.
- Novo módulo `21-family-shared-experience.js` carregado depois da camada de implantação e antes do bootstrap.
- Sintaxe JavaScript validada com `node --check` em **42 arquivos** de frontend/API/server/service worker.
- Todos os arquivos JSON parseados com sucesso.
- `index.html`, `equipe.html`, `meu-piaget.html`, `pagamento.html` e `obrigado.html` sem referências locais ausentes.
- Service worker atualizado para a nova release e para o módulo 21.
- Backend de carrinho familiar valida que todos os alunos atribuídos compartilham a mesma conta financeira.
- Pedidos de Cantina, Fardamento e operacionais gerados por vendas multi-aluno mantêm o aluno destinatário individual.
- Notificações pós-pagamento online corrigidas para usar o aluno de cada pedido, em vez de atribuir todos ao aluno principal.
- Núcleo de `16-cash-responsibility.js` comparado com a RC2.7.1: conteúdo funcional idêntico, variando apenas o identificador textual da versão.
- Marco Zero não é automático.
- Nenhum CPF completo foi incluído no frontend/base estática.

Observação: a validação local é estrutural/sintática. Fluxos que dependem de Firebase/InfinitePay devem ser confirmados no ambiente publicado antes do Marco Zero.
