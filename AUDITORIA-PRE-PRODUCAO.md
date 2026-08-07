# Auditoria pré-produção — RC2.7.6

## Resultado executivo

A principal exposição externa identificada na RC2.7.5 era o Firestore com regra universal de leitura/escrita. A RC2.7.6 contém a arquitetura e as Rules para remover essa exposição sem redesenhar o Meu Piaget.

### Resolvido nesta candidata (após publicação das Rules)

- acesso anônimo ao Firestore;
- leitura cruzada entre famílias;
- acesso direto do responsável a hashes/salts de senha, sessões, resets e auditoria;
- persistência da sessão familiar em token legível pelo JavaScript;
- confiança em perfil de funcionário enviado pelo navegador nas APIs sensíveis;
- gravação direta de autorização/limite financeiro pelo navegador do responsável;
- ausência de throttling nos principais endpoints de acesso.

### Mantido por compatibilidade

- frontend continua HTML/CSS/JS e Firestore Web SDK;
- experiência do Meu Piaget continua igual;
- Firebase Auth da equipe continua igual;
- 10 funções Vercel;
- módulos, rotas, pagamentos, conta familiar e caixa preservados.

## Riscos residuais / próximos endurecimentos

1. **Permissão técnica interna ampla:** funcionário interno autenticado/ativo ainda satisfaz uma regra ampla do Firestore. Isso preserva Secretaria/Cantina durante o fechamento funcional. Depois da auditoria completa da Cantina, restringir por perfil/coleção.
2. **App Check:** ainda não é obrigatório. Pode reduzir abuso automatizado de APIs/SDK, mas deve ser implantado depois do piloto controlado para evitar regressão de dispositivos.
3. **CSP:** há muito JavaScript inline/event handlers legados; uma Content-Security-Policy estrita exige refatoração específica. Os demais headers de segurança permanecem ativos.
4. **Endpoint público de verificação de pagamento:** precisa permanecer acessível ao fluxo de retorno. Ele revalida a transação no servidor antes de aplicar valores; futuramente pode receber um token de retorno adicional.
5. **Rules precisam de teste real:** a validação local feita aqui é estrutural. Publicar primeiro o código, depois as Rules, e executar a bateria do guia.

## Desempenho

A RC2.7.5 já havia aplicado lazy loading de bibliotecas pesadas e cache versionado. A RC2.7.6 não introduz novas bibliotecas no carregamento inicial. O Custom Token adiciona uma etapa curta somente durante login/reabertura da sessão; depois as leituras continuam pelo Firestore Web SDK com as mesmas telas e consultas.
