# Validação técnica — 1.6.0-rc2.1-carrinho-modal-hotfix

## Causa encontrada

O submodal de fardamento/negociação substituía o conteúdo do modal principal. Ao confirmar, `addCatalogLineV160()` chamava `renderCatalogPickerV160()` antes de reconstruir a venda. Nesse momento, `#v160OperationBody` não existia, provocando uma exceção e interrompendo o fluxo antes do retorno ao carrinho.

## Correção

- Inclusão do item separada da renderização do carrinho.
- Reconstrução controlada do modal principal após a confirmação.
- Ação contextual do botão **×** no submodal.
- Botão explícito **Voltar ao carrinho**.

## Verificações locais

- Sintaxe de todos os arquivos JavaScript.
- Carregamento conjunto dos módulos frontend.
- Carregamento dos módulos de API.
- Teste estático das funções e handlers do novo retorno ao carrinho.
- Integridade do ZIP.

A validação final ainda depende do deploy e do teste no navegador com o Firestore real.
