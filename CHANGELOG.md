# Changelog — V1.5.0-dev3-clean

## Refatoração

- Removidas as várias versões concorrentes do portal do responsável.
- Criado um único fluxo de renderização para login, sessão restaurada e retorno do checkout.
- Removidos listeners de inicialização duplicados.
- Separado o código por domínio, reduzindo o `index.html` e facilitando manutenção.
- Removidas gravações automáticas atrasadas de versão no Firestore.
- Adicionado tratamento visível para erros ocorridos durante a inicialização.
- Corrigida a prioridade dos dados do comprador: dados salvos ou informados no pagamento não são mais substituídos pelo cadastro básico do aluno.

## Portal do responsável

- Mantida a central compacta da dev2.
- Mantidos Cantina, Fardamento, Meus pedidos, Movimentações, Comprador e Autorizações.
- Adicionado acesso explícito à criação/alteração da senha.
- Pedido semanal ou mensal continua detalhando cada entrega diária.

## Operação

- Preservadas as alterações da secretaria, agenda da cantina, estoque diário, fardas, checkout e conta corrente.
- Mantido menu mobile lateral sem barra horizontal inferior.
