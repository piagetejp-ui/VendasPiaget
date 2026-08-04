# Roteiro de testes — 1.6.0-rc2.1-carrinho-modal-hotfix

## Teste prioritário: itens com configuração

Execute os dois cenários em **Venda presencial** e em **Venda online**.

### Fardamento

1. Selecione um aluno.
2. Entre em **Produtos e serviços** e abra **Fardamento**.
3. Escolha tamanho, modelo e quantidade.
4. Clique em **Adicionar ao carrinho**.
5. Confirme que o sistema retorna ao carrinho e mostra a farda adicionada.
6. Abra novamente o formulário e use **Voltar ao carrinho**.
7. Repita usando o botão **×**. A venda deve continuar aberta.

### Negociação ou cobrança de valor livre

1. Abra o item de negociação.
2. Informe referência/descrição, valor e quantidade.
3. Clique em **Adicionar ao carrinho**.
4. Confirme o retorno ao carrinho com descrição e valor preservados.
5. Prossiga até pagamento presencial ou geração do link.

## Regressão rápida

- Produto simples entra diretamente no carrinho.
- Mensalidade exige competência.
- Botões de aumentar, diminuir e remover continuam funcionando.
- O botão geral de fechar na venda principal ainda encerra a venda.
- Portal do responsável e checkout permanecem sem alteração funcional nesta versão.
