# Sistema de Vendas Escola Piaget — RC2.7

**Versão:** `1.6.0-rc2.7-meu-piaget-familias`  
**Status:** candidata para teste real após publicação pelo usuário.

## Objetivo desta release

Esta versão prepara a implantação do sistema com dados reais e separa a experiência da equipe da experiência das famílias, preservando os fluxos operacionais consolidados na RC2.6.

### Entradas

- `index.html` / `equipe.html` — **Equipe Piaget**: Secretaria, Gestão e Cantina.
- `meu-piaget.html` — **Meu Piaget**: acesso da família.
- `pagamento.html` — página pública de cobrança gerada pela Secretaria.
- `obrigado.html` — retorno de pagamento.

Os portais usam o mesmo Firebase/Firestore e o mesmo backend. A separação por domínio pode ser ativada depois apontando domínios diferentes para a mesma implantação e configurando `PUBLIC_FAMILY_BASE_URL` e `PUBLIC_API_BASE_URL`.

## Base oficial 2026

A base foi construída a partir dos três relatórios SIGA fornecidos em 07/08/2026:

- lista atual de alunos por turma;
- relação de responsáveis financeiros e alunos;
- relação de responsáveis com mais de um aluno.

A fotografia contém:

- 214 alunos ativos;
- 187 responsáveis financeiros;
- 214 vínculos responsável ↔ aluno;
- 24 responsáveis com mais de um aluno;
- 1 cadastro com CPF incompleto no relatório de origem, que deve ser corrigido manualmente pela Gestão antes do Marco Zero.

CPFs válidos não são enviados em texto puro no código do frontend. A base server-side usa hash SHA-256 para localização por CPF.

## Modelo familiar

- O responsável financeiro é o titular do login do **Meu Piaget**.
- O aluno continua sendo a unidade operacional de pedido, lanche, fardamento, evento e atendimento.
- Uma família com irmãos possui uma conta financeira compartilhada.
- O saldo/crédito/dívida e o limite são únicos por responsável financeiro.
- O limite máximo familiar é proporcional à quantidade de alunos ativos vinculados.
- Cada movimentação continua registrando o aluno que a originou.
- Um responsável com um aluno entra diretamente na experiência daquele aluno.
- Com irmãos, o Meu Piaget exibe seletor de aluno.
- O comprador de uma transação continua independente do responsável financeiro e pode ser editado no checkout.

## Primeiro acesso e senha

Primeiro acesso:

1. CPF do responsável financeiro;
2. matrícula de qualquer aluno ativo vinculado;
3. criação da senha permanente.

Depois, o acesso é feito com CPF + senha.

A recuperação de senha continua assistida pela Secretaria: a família solicita, a equipe gera um link temporário e envia pelo canal de atendimento, normalmente WhatsApp.

## Ano letivo

A RC2.7 cria `matriculas_ano` e mantém a enturmação de 2026 como registro histórico. Mudanças futuras de turma/ano devem criar uma nova enturmação em vez de apagar o histórico anterior.

## Marco Zero

O reset **não é automático** ao publicar a RC2.7.

Em Gestão → Configurações → Meu Piaget e implantação:

1. preparar a base oficial;
2. revisar/corrigir cadastros de acesso pendentes;
3. testar Equipe Piaget e Meu Piaget;
4. visualizar a prévia do Marco Zero;
5. somente quando aprovado, digitar `INICIAR OPERAÇÃO REAL`.

Antes da limpeza, o sistema cria um backup interno dos dados operacionais de teste. Catálogo, preços, estoques atuais, configurações, usuários da equipe e base oficial de alunos/responsáveis são preservados.

A preparação da base não zera saldo: quando uma família ainda não possui conta familiar, o saldo líquido das antigas contas de seus alunos é consolidado temporariamente. O zeramento acontece apenas no Marco Zero.

## Publicação

Publicar o conteúdo completo deste ZIP, mantendo:

- `index.html` na raiz;
- `equipe.html` e `meu-piaget.html` na raiz;
- `api/`, `assets/` e `releases/` na hierarquia original;
- a release física `releases/1.6.0-rc2.7-meu-piaget-familias/`.

Não declarar a RC2.7 validada antes do teste real após deploy.
