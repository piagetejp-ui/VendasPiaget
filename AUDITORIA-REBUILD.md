# Auditoria do rebuild

## Problema removido

O CSS anterior mantinha comportamentos responsivos de várias versões. A mesma barra lateral era tratada como grade, barra inferior e menu flutuante em media queries diferentes. A dev5 remove todas essas media queries antigas no processo de build.

## Estrutura nova

- Desktop preservado pela base visual existente.
- Um breakpoint de tablet e um breakpoint mobile.
- Menu interno lateral único.
- Sem barra de navegação junto aos gestos do aparelho.
- Uma função de viewport para teclado e Safari.
- Uma rotina de adaptação das tabelas.

## Cache e versões

A URL do arquivo muda fisicamente entre versões. Exemplo:

`/releases/1.5.0-dev5.1-logo-hotfix/js/01-core.js`

Uma versão futura deve usar outra pasta. O aparelho não pode combinar os arquivos das duas versões.
