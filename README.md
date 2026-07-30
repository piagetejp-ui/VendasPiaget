# Escola Piaget — Sistema de Vendas V1.4.1 Checkout Oficial

Esta versão foi gerada a partir da V1.3.4 aprovada. A V1.4.0 anterior foi descartada e não deve ser usada como base.

## O que entrou nesta versão

### Conta corrente do aluno

O sistema passa a tratar crédito e saldo em aberto como uma conta corrente única:

- saldo positivo = crédito disponível;
- saldo zero = conta regular;
- saldo negativo = saldo em aberto.

Por compatibilidade com os dados já existentes, o sistema ainda mantém os campos `saldoCreditoCentavos` e `dividaCentavos`, mas também passa a gravar `saldoContaCentavos` como o saldo líquido.

### Checkout InfinitePay

Checkout ativo nesta versão:

- entrada na conta do aluno;
- regularização de saldo negativo;
- adição de crédito quando a conta estiver zerada ou positiva.

O pagamento só aplica efeito depois de confirmação por:

1. webhook da InfinitePay; ou
2. botão manual “Verificar pagamento”.

### Regra de valor mínimo

- Se o aluno estiver com saldo negativo, o valor mínimo do checkout é o necessário para zerar o saldo.
- Se o aluno estiver com saldo zero ou positivo, o mínimo inicial é R$ 1,00, configurável em Configurações.

### Bloqueio semanal

Regra oficial:

- toda sexta-feira, no fechamento semanal, alunos com saldo negativo são bloqueados;
- ao regularizar para saldo zero ou positivo, o desbloqueio é automático.

### Perfis que podem gerar pagamento

- Responsável: pode gerar pagamento para o próprio aluno no portal;
- Secretaria: pode gerar link e registrar pagamento presencial;
- Gestão/Administração: acesso completo;
- Cantina: não gera link nesta versão.

### Pagamento presencial

A secretaria/gestão pode registrar pagamento presencial em:

- dinheiro;
- Pix manual;
- maquininha;
- Pix banco;
- Pix Rede / Laranjinha;
- Cartão Rede / Laranjinha.

Esse lançamento entra na mesma conta corrente do aluno e não usa link InfinitePay.

## Variáveis de ambiente necessárias na Vercel

Já devem estar cadastradas no projeto Vercel:

```txt
INFINITEPAY_HANDLE=piaget
PUBLIC_BASE_URL=https://vendas-piaget.vercel.app
FIREBASE_PROJECT_ID=vendaspiaget
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## Endpoints incluídos

```txt
/api/criar-checkout
/api/verificar-pagamento
/api/webhook-infinitepay
```

URLs finais:

```txt
Redirect URL:
https://vendas-piaget.vercel.app/obrigado.html

Webhook URL:
https://vendas-piaget.vercel.app/api/webhook-infinitepay
```

## Como testar

1. Subir este pacote na Vercel.
2. Entrar no portal do responsável ou na área de Alunos e Contas.
3. Abrir um aluno.
4. Clicar em “Adicionar crédito” ou “Gerar link InfinitePay”.
5. Usar valor de teste, como R$ 1,00 se o saldo estiver regular.
6. Confirmar o pagamento na InfinitePay.
7. Voltar para o sistema e conferir se o saldo foi atualizado.
8. Na tela Cobranças e saldos, usar “Verificar pagamento” se o webhook demorar.

## Observações

- Cartão não é armazenado no sistema da escola.
- Dados opcionais do comprador são apenas nome, telefone e e-mail.
- Se houver link pendente, o sistema permite gerar outro, mas avisa. Se dois links forem pagos, os dois valores entram no saldo.

## V1.4.2 — Como testar os ajustes

1. Gere um pagamento pelo portal do responsável.
2. Pague pelo checkout da InfinitePay.
3. Na página `obrigado.html`, verifique se aparece o resumo do pagamento.
4. Teste os botões:
   - Verificar novamente;
   - Imprimir / salvar PDF;
   - Baixar comprovante em imagem;
   - Voltar ao sistema.
5. Ao voltar ao sistema, o portal do responsável deve abrir automaticamente se a sessão local ainda estiver salva no navegador.
6. No portal do responsável, confira:
   - saldo atualizado;
   - extrato com nomes humanizados;
   - campo “Dados do comprador”.
7. Em Cobranças e saldos, confira o botão “Comprovante” nos pagamentos confirmados.


## Nota V1.4.3

Esta versão substitui a V1.4.2. A correção principal está no portal do responsável, que agora renderiza corretamente após login e após retorno do checkout. Também foi adicionada uma camada de compatibilidade para evitar erro quando componentes novos chamarem funções do checkout adicionadas em versões anteriores.
