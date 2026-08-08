# Auditoria pré-produção — RC2.7.8

## Estado da candidata

A RC2.7.8 parte do checkout validado na RC2.7.7 e concentra mudanças de experiência pública, domínio, documentos e pequenos ajustes operacionais. Não há migração automática nem Marco Zero no deploy.

## Desempenho

- Meu Piaget continua orientado a celular e sem dependências novas no carregamento inicial.
- Bibliotecas de PDF podem ser preparadas apenas quando necessárias no portal do responsável.
- Arquivos de release permanecem versionados e com cache imutável; HTML, service worker e `version.json` não usam cache persistente.
- A venda presencial em rascunho usa armazenamento local curto e não cria venda no Firestore antes da confirmação.

## Segurança

Mantidos:

- senha do responsável validada por hash, nunca texto puro;
- sessão familiar revogável e cookie seguro;
- identidade técnica Firebase sem cadastro manual dos 187 responsáveis;
- APIs sensíveis da equipe verificando Firebase ID Token;
- checkout/confirmacão de pagamento no servidor;
- validação de URL retornada pela InfinitePay;
- separação entre domínio público da família e domínio técnico do webhook.

### Firestore

O pacote inclui Rules restritivas, porém elas **não são ativadas pela Vercel**. Enquanto o Firebase real continuar com regra de desenvolvimento, o banco continua exposto tecnicamente. A ativação deve ocorrer apenas depois de validar a RC2.7.8 no domínio `meupiaget.com.br` e adicionar o domínio em Firebase Authentication → Authorized domains.

## Riscos residuais

1. Funcionários internos autenticados ainda possuem permissão técnica ampla nas Rules preparadas para preservar os módulos existentes; restringir por cargo depois da auditoria completa da Cantina.
2. CSP estrita ainda exigiria retirar handlers/JavaScript inline legados; os demais headers de segurança permanecem ativos.
3. PDFs são gerados no navegador com dados reais; a validação visual final deve ser feita no ambiente publicado, pois o ambiente local não possui os dados reais do Firestore.
4. O domínio personalizado depende de DNS/HTTPS/Firebase Authorized Domains externos ao ZIP.

## Recomendação de entrada em operação

DNS → domínio verde na Vercel → Authorized Domains no Firebase → deploy RC2.7.8 → regressão funcional → PDFs/checkout → Rules → regressão pós-Rules → piloto controlado → Marco Zero somente quando autorizado.
