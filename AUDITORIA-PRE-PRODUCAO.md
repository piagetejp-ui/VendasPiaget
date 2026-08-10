# Auditoria pré-produção — RC2.7.11

## Estado da candidata

A RC2.7.11 parte diretamente da RC2.7.10, cujo fluxo de cobrança direta foi validado pelo usuário. A candidata adiciona o sistema de relatórios/PDFs e dois refinamentos de interface: situação financeira Regular/Pendente e persistência do aviso do Caixa em Vendas.

Não há migração automática, alteração funcional de `/api`/`server` nem Marco Zero no deploy.

## Desempenho

- novo módulo documental é JavaScript estático e gera PDF apenas sob ação do usuário;
- não adiciona nova função serverless;
- bibliotecas de PDF continuam carregadas sob demanda quando necessário;
- 10 funções físicas em `/api` permanecem.

## Segurança

Mantidos:

- senha do responsável validada por hash;
- sessão familiar revogável e identidade técnica Firebase;
- validação server-side do checkout/InfinitePay;
- domínio público `meupiaget.com.br` separado da experiência da Equipe;
- Rules restritivas empacotadas, porém não ativadas automaticamente.

Enquanto o Firebase real permanecer com a regra de desenvolvimento aberta, o banco continua sendo um bloqueador de produção. A publicação das Rules deve acontecer somente depois da regressão funcional da RC2.7.11 e deve ser seguida de nova regressão.

## Riscos residuais

1. Os PDFs reais usam dados de runtime/Firestore; o teste local não substitui inspeção visual no ambiente publicado.
2. O aviso persistente do Caixa depende da re-renderização real da tela e deve ser testado com o X da venda presencial.
3. Funcionários internos ainda possuem permissão técnica ampla nas Rules preparadas para preservar módulos legados; a segmentação mais fina por cargo pode ser revisada depois da auditoria completa da Cantina.
4. CSP estrita ainda exigiria remover handlers JavaScript inline legados.

## Sequência recomendada

Deploy RC2.7.11 → testar aviso do Caixa → testar Regular/Pendente → emitir todos os relatórios/documentos → regressão de pagamento → publicar Firestore Rules → regressão pós-Rules → piloto controlado → Marco Zero somente quando autorizado.
