# Vendas Piaget — V1 integrada

## Conteúdo
- `index.html`: aplicação completa em um único HTML, com os 217 alunos reais incorporados para a primeira importação.
- `obrigado.html`: retorno do checkout.
- `api/`: criação do checkout, webhook e verificação da InfinitePay.
- `lib/`: Firebase Admin e processamento idempotente de pagamentos.
- `firestore.rules`: regra temporária de desenvolvimento, sem Authentication.

## Primeiro uso
1. No Firebase `vendaspiaget`, publique temporariamente o conteúdo de `firestore.rules`.
2. Abra o `index.html` por um servidor local ou faça deploy na Vercel.
3. Clique em **Importar base real**. O sistema grava alunos, contas zeradas, produtos, turmas e usuários provisórios. A inicialização não sobrescreve uma base já existente.
4. Use os acessos provisórios de Ruan, Daniele, Evanda ou Lucas.

## InfinitePay na Vercel
Configure estas variáveis de ambiente:
- `FIREBASE_PROJECT_ID=vendaspiaget`
- `FIREBASE_CLIENT_EMAIL=...`
- `FIREBASE_PRIVATE_KEY=...`
- `INFINITEPAY_HANDLE=piaget`
- `PUBLIC_BASE_URL=https://seu-dominio.vercel.app`

As credenciais Firebase Admin nunca devem ser colocadas no HTML.

## Situação de segurança
A V1 está preparada para desenvolvimento sem Authentication, conforme solicitado. As regras temporárias deixam o banco acessível a qualquer pessoa que conheça o projeto ou o endereço publicado. Antes de uso real/publicação, ativar Authentication e substituir as regras.

## Dados e regras implantados
- 217 alunos reais; os registros chamados “Aluno de teste” foram excluídos.
- A matrícula duplicada `230106` é preservada em dois IDs internos diferentes; a pergunta de confirmação resolve qual aluno deve ser aberto.
- Teto da escola para fiado: R$ 50; o responsável pode definir valor menor.
- Pagamento quita dívida antes de gerar crédito.
- 30 salgados por dia, editável.
- Recreios: 9h–9h30, 9h30–10h e 15h30–16h.
- Lanche completo = soma de salgado + suco ou salgado + refrigerante.
- Camisa de farda: 4–14 por R$ 42; P–XGG por R$ 47, com modelo masculino/feminino a partir do P.

## Correção 1.0.1
A persistência offline do Firestore foi removida do carregamento inicial. Em alguns navegadores, o SDK compat já iniciava a instância antes de `enablePersistence`, provocando a mensagem “Firestore has already been started”. A aplicação agora conecta diretamente ao Firestore e continua funcionando normalmente online.
