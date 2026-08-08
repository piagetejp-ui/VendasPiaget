# Changelog — 1.6.0-rc2.7.8

## Domínio oficial e experiência do responsável

- O endereço público do Meu Piaget foi centralizado em `https://meupiaget.com.br`.
- `meupiaget.com.br` passa a ser a origem usada em links de venda online, regularização, primeiro acesso, redefinição de senha e retorno de pagamento.
- O domínio técnico da Equipe pode continuar na Vercel; o webhook da InfinitePay pode usar `PUBLIC_API_BASE_URL` separadamente.
- No domínio `meupiaget.com.br`, `/` e `/index.html` são roteados para `meu-piaget.html`; a área da Equipe não é apresentada ao responsável.
- O `www.meupiaget.com.br` fica como redirecionamento 308 para o domínio raiz na configuração de domínio da Vercel.

## Retorno da InfinitePay

- O botão da página de retorno agora é **Voltar ao Meu Piaget**.
- O retorno leva a `https://meupiaget.com.br/?retornoCheckout=1`, em vez da raiz da Equipe.
- Ao retornar, o Meu Piaget atualiza a experiência e mostra confirmação do processamento do pagamento.
- A autorização de checkout corrigida na RC2.7.7 foi preservada.

## Documentos e PDFs

- Criado cabeçalho documental comum para documentos voltados à família, com logo oficial, hierarquia visual e identificação Meu Piaget.
- PDF de primeiro acesso passa a trazer link clicável e QR Code para `meupiaget.com.br`.
- Instruções distinguem primeiro acesso (CPF + matrícula) de acesso já ativado (CPF + senha criada), com orientação de procurar a Secretaria em caso de dificuldade.
- PDF do fechamento semanal/regularização foi reorganizado por conta familiar e por aluno, com total, instruções, link e QR Code.
- Comprovante PDF do responsável foi alinhado à mesma identidade documental.

## Secretaria — venda presencial

- Caixa fechado ou sob responsabilidade de outro operador não bloqueia Pix, cartão ou saldo.
- Somente **Dinheiro** fica indisponível sem caixa aberto sob responsabilidade do operador.
- A validação de caixa para dinheiro permanece também no momento da confirmação.
- Venda presencial não concluída passa a ser salva como rascunho local por até 12 horas.
- Ao retornar à tela de Vendas, aparece **Continuar último carrinho** ou **Descartar**.
- O rascunho preserva aluno/família, operação, itens, programações, quantidades e filtros; formas de pagamento não são restauradas.
- Venda concluída ou descarte explícito remove o rascunho, evitando duplicidade.

## Meu Piaget — refinamentos

- Removido o menu hambúrguer redundante do cabeçalho do Meu Piaget.
- Login exibe estado **Entrando…** com indicador de carregamento enquanto a sessão é preparada.
- Pedidos da família passam a mostrar explicitamente a data/período programado do lanche.
- A ação **Detalhar** fica visualmente explícita nos cards de pedido.
- Bloqueio semanal gera notificação acionável **Conta bloqueada por pendência → Regularizar agora**.
- Regularização/desbloqueio gera notificação **Conta regularizada**.

## Segurança

- Mantida a arquitetura da RC2.7.7: sessão familiar segura + identidade técnica Firebase, sem cadastro manual dos responsáveis no Firebase Authentication.
- As novas Firestore Rules continuam incluídas no pacote, mas **não devem ser publicadas antes da validação da RC2.7.8 no domínio novo**.
- Após o DNS ficar ativo, `meupiaget.com.br` deve ser adicionado em Firebase Authentication → Authorized domains antes do teste do Meu Piaget no domínio personalizado.

## Compatibilidade

- `/api` permanece com 10 funções físicas para o plano Vercel Hobby.
- Marco Zero continua exclusivamente manual.
- Núcleo contábil do caixa, sessões, responsabilidades e divergências foi preservado; a única mudança no módulo de caixa é a UX de seleção da forma de pagamento quando dinheiro está indisponível.
