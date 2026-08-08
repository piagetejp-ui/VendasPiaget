# Testes — RC2.7.8

## 1. Regressão mínima após deploy

- Gestão/Secretaria: login e carregamento das telas principais.
- Meu Piaget: CPF + senha e primeiro acesso CPF + matrícula.
- Família com um aluno e família com irmãos.
- Venda online da Secretaria e checkout InfinitePay.
- Regularização de saldo pelo Meu Piaget.
- Confirmar que o hotfix de autorização da RC2.7.7 continua funcionando.

## 2. Domínio `meupiaget.com.br`

Somente depois de DNS verde na Vercel e domínio adicionado ao Firebase Auth:

- `https://meupiaget.com.br` abre diretamente o Meu Piaget;
- a barra do navegador permanece em `meupiaget.com.br`;
- `www.meupiaget.com.br` redireciona para o domínio raiz;
- `https://meupiaget.com.br/equipe.html` não expõe a tela da Equipe;
- login e reload mantêm a sessão;
- logout encerra a sessão.

## 3. Pagamentos e retorno

- gerar checkout individual;
- gerar checkout familiar/multi-aluno;
- pagar/usar retorno de teste permitido pelo ambiente;
- `obrigado.html` exibe **Voltar ao Meu Piaget**;
- o botão leva para `meupiaget.com.br/?retornoCheckout=1`;
- ao voltar, o Meu Piaget mostra confirmação e atualiza saldo/pedidos;
- webhook continua apontando para o endereço técnico configurado em `PUBLIC_API_BASE_URL`;
- Pagamentos pendentes não duplica cobrança.

## 4. PDFs e documentos

Gerar no ambiente publicado e conferir visualmente:

- PDF de primeiro acesso;
- PDF de fechamento semanal/regularização;
- comprovante PDF do responsável;
- comprovante de venda e relatório de caixa já existentes.

Verificar logo sem distorção, textos sem corte, valores, nome/turma, links clicáveis e QR Code. No primeiro acesso, conferir a orientação: CPF + matrícula; depois CPF + senha criada.

## 5. Caixa fechado

Com caixa fechado:

- montar venda presencial normalmente;
- Pix disponível;
- cartão disponível;
- saldo disponível;
- Dinheiro desabilitado/recusado com aviso claro;
- nenhuma tela força abertura do caixa só para Pix/cartão/saldo.

Com caixa aberto sob responsabilidade do operador:

- Dinheiro volta a ficar disponível;
- confirmação em dinheiro continua revalidando a sessão/responsabilidade.

## 6. Rascunho de venda presencial

- montar carrinho presencial e fechar antes de pagar;
- voltar à tela de Vendas e ver **Venda presencial em andamento**;
- continuar e conferir aluno/família, itens, quantidades e programação;
- confirmar que formas de pagamento não são restauradas;
- concluir a venda e confirmar que o rascunho desaparece;
- repetir e usar **Descartar**;
- rascunho com mais de 12 horas deve ser ignorado/removido.

## 7. Meu Piaget — interface

- cabeçalho sem menu hambúrguer redundante;
- sino de notificações preservado;
- login exibe **Entrando…** durante autenticação;
- Pedidos da família mostra data/período do lanche;
- **Detalhar** é visualmente explícito e expande corretamente.

## 8. Notificações de cobrança

- fechamento semanal com conta negativa cria notificação **Conta bloqueada por pendência**;
- **Regularizar agora** abre o fluxo correto;
- após regularização, conta é desbloqueada e aparece **Conta regularizada**.

## 9. Firestore Rules

**Não fazer esta etapa até todos os testes acima passarem.** Depois seguir `GUIA-ATIVACAO-SEGURANCA-RC2.7.8.md`.
