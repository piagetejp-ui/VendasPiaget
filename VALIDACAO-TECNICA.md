# Validação técnica executada — V1.5.0-dev4-clean

Foram executadas verificações automáticas locais antes da geração do pacote:

- sintaxe de todos os módulos JavaScript do frontend e das APIs Node.js;
- carregamento conjunto dos módulos no mesmo contexto para detectar conflitos de escopo;
- confirmação de uma única função oficial `renderParentPortal()`, um único `boot()` e um único roteador `navigate()`;
- portal do responsável com nove ações, incluindo Fardamento e Pagamentos pendentes;
- restauração da sessão e proteção do fluxo de redefinição de senha;
- cálculo com uso do saldo desativado: compra externa preserva o crédito existente;
- cálculo com uso do saldo ativado: saldo é consumido e somente a diferença é cobrada;
- cálculo com saldo negativo: pagamento mínimo inclui regularização e compra;
- botão mobile interno reaparecendo para o perfil Cantina e abrindo o menu lateral;
- tentativa idempotente de checkout registrada em `tentativas_checkout`;
- separação entre `preparando_link` e `aguardando_pagamento`;
- presença da área de retomada de pagamentos pendentes;
- preservação do endpoint e do formato básico de payload da integração InfinitePay;
- registro de tempos da preparação interna e da chamada externa.

Estas verificações não substituem o deploy de Preview e os testes reais com Firebase Authentication, Firestore e InfinitePay descritos em `TESTES.md`.
