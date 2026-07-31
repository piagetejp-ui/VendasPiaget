# Validação técnica executada — V1.5.0-dev3-clean

Foram executadas verificações automáticas locais antes da geração do pacote:

- carregamento conjunto de todos os módulos JavaScript no mesmo contexto, para identificar conflitos de nomes e escopo;
- confirmação de uma única função oficial `renderParentPortal()`;
- renderização do portal compacto com oito ações, incluindo Cantina e Fardamento;
- login do responsável renderizando a tela correta;
- restauração de sessão direcionando ao portal canônico;
- proteção do fluxo de redefinição de senha contra sobrescrita por sessão antiga;
- ausência de chamadas para `renderParentPortalV...` no módulo de autenticação;
- sintaxe de todos os módulos frontend e APIs;
- cálculos puros de saldo positivo, saldo negativo e divisão da conta corrente;
- prioridade correta dos dados salvos do comprador e dos dados informados no pagamento;
- presença de nome, telefone e e-mail no payload enviado à InfinitePay;
- URLs de redirect e webhook configuradas corretamente;
- integridade do arquivo ZIP.

Estas verificações não substituem o deploy de Preview e os testes reais com Firebase Authentication, Firestore e InfinitePay descritos em `TESTES.md`.
