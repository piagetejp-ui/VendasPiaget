# Changelog — 1.6.0-rc2.7.13

## Hotfix — login do responsável com Firestore fechado

- O login por CPF + senha continua sendo validado no backend antes de qualquer autenticação Firebase.
- O backend passa a criar um espelho seguro por sessão em `familias_auth/{sessionId}` antes de emitir o Firebase Custom Token.
- O UID Firebase permanece estável por família; cada login ganha um `sessionId` próprio e um espelho separado, permitindo sessões simultâneas sem criar um novo usuário Firebase a cada login.
- As Firestore Rules deixam de depender de leituras encadeadas em `sessoes_meu_piaget` e `responsaveis_acesso` em toda consulta do portal e passam a validar o espelho `familias_auth`.
- O espelho exige: sessão ativa, `responsavelId` correspondente, `sessionId` correspondente e prazo `expiraEmMs` posterior ao horário da requisição.
- Logout e revogação de sessões também inativam o respectivo espelho em `familias_auth`.
- O frontend valida os claims do Firebase após `signInWithCustomToken` e executa um `family_auth_probe` no backend antes de abrir o Firestore.
- Se o backend estiver correto mas as Rules antigas ainda estiverem publicadas, o portal passa a informar explicitamente que as Firestore Rules da RC2.7.13 também precisam ser publicadas, em vez de exibir somente `Missing or insufficient permissions`.
- Autenticação da equipe (`usuarios_auth`) não foi redesenhada.

## Compatibilidade preservada

- Marco Zero por data da RC2.7.12 preservado integralmente: corte em 10/08/2026 00:00 — America/Fortaleza.
- Dados de 10/08/2026 em diante continuam protegidos como implantação piloto.
- Logo simples nos PDFs preservada.
- Checkout/InfinitePay, Caixa, carrinho multi-aluno, domínio e roteamento não foram redesenhados.
- O pacote não publica Firestore Rules nem executa deploy automaticamente.
- O Marco Zero continua manual.

---

## Histórico resumido

### RC2.7.12 — Marco Zero por data + logo simples nos PDFs
- Marco Zero passou de reset global para corte por data.
- Registros até 09/08/2026 são arquivados; registros de 10/08/2026 em diante são preservados.
- Contas familiares são reconstruídas pelas movimentações pós-corte, sem zeragem indiscriminada.
- Cabeçalhos dos PDFs passaram a usar `logo-piaget-icon-v152.png`.

### RC2.7.11 — relatórios, PDFs e refinamentos
- Relatórios de Vendas, Cobranças, Caixa, Pedidos, Movimentações e Contas.
- Documentos individuais padronizados.
- Status financeiro Regular/Pendente.
- Persistência do aviso do caixa na tela de Vendas.

### RC2.7.10 — hotfix de cobrança direta
- Corrigido Gerar cobrança / Regularizar saldo na Gestão e no Meu Piaget.

### RC2.7.9 — hotfix de domínio
- Corrigido `meupiaget.com.br/` para abrir o Meu Piaget.
