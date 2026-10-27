# Changelog — Sistema de Vendas Piaget

## 1.6.0-rc2.7.61 — 27/10/2026

Base: **RC2.7.60**.

### Melhoria: discriminação do que está sendo cobrado no link de venda online (`pagamento.html`)

- A RC2.7.58 já tinha corrigido a discriminação **dentro do link da InfinitePay** (o checkout em si lista a compra e a regularização como itens separados). Mas a tela **antes** disso — `pagamento.html`, "Confira a cobrança", que a família vê primeiro ao abrir o link da secretaria — continuava mostrando só "Valor da compra" e "Pagamento estimado" como dois números diferentes, sem explicar por que eles não batem. Era exatamente o ponto do pedido original: "ele não mostra o que ele acrescentou".
- Agora, quando o link embute saldo em aberto (o pagamento estimado é maior que a compra), aparece uma linha **"Regularização de saldo em aberto"** com a diferença. Quando usa crédito da conta (o pagamento estimado é menor), aparece **"Crédito utilizado"**. Operações puras de crédito/regularização (sem compra junto) continuam com o rótulo único que já tinham, sem mudança.
- Calculado só com os dois totais que a API já retornava — nenhuma mudança no servidor foi necessária.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.60.

## 1.6.0-rc2.7.60 — 27/10/2026

Base: **RC2.7.59**.

### Correção: telefone pré-preenchido, mas travado como inválido, no link de venda online (`pagamento.html`)

- **Este é o bug de telefone que o Lucas relatou originalmente** — só que ele vive numa página diferente das que eu tinha corrigido até aqui. `pagamento.html` é a tela aberta pela família quando a secretaria gera um **link de venda online** (lanche, fardamento, crédito, regularização) e manda pra família — separada do fluxo de "conta familiar" (`openAccountPaymentV141`/`checkoutBuyerStepV157`) que foi corrigido na RC2.7.58/59.
- **Causa raiz**: essa página busca o comprador salvo (`dados_pagamento_responsavel`) e preenche o campo de telefone **direto com o valor salvo no formato canônico `+55DDDNÚMERO`** (12-13 dígitos). Só que a validação própria dessa página (`buyerIssues`) só aceita telefone no formato local — DDD + número, 10 ou 11 dígitos, sem o `+55`. Resultado: toda família que já tinha um comprador salvo via o campo de telefone **pré-preenchido, mas marcado em vermelho como inválido** ("Informe um telefone com DDD"), e precisava apagar e redigitar o número do zero pra conseguir continuar — mesmo o dado já estando certo.
- Corrigido retirando o "+55" do valor antes de mostrar no resumo e no campo editável (mesma lógica de desambiguação por tamanho total já usada em `12-portal-finalization.js`), então agora o campo aparece pré-preenchido no formato que a validação espera e passa direto, sem precisar reditar nada.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.59.

## 1.6.0-rc2.7.59 — 27/10/2026

Base: **RC2.7.58**.

### Correção crítica: loop infinito de "atualização disponível" (tela piscando, URL mudando sozinha)

- **Causa raiz**: todo release bump precisa atualizar duas coisas em paralelo — o `version.json` publicado (que o navegador consulta para saber se há versão nova) e a constante `APP_VERSION_CLEAN`, embutida dentro do próprio `11-bootstrap.js` que é servido dentro da pasta daquele release (é com ela que o navegador compara o que já está rodando). Na RC2.7.58 eu atualizei o `version.json` para `1.6.0-rc2.7.58`, mas esqueci de atualizar a constante dentro dos arquivos JS da própria pasta `releases/1.6.0-rc2.7.58/js/`, que continuaram declarando `1.6.0-rc2.7.57`.
- Resultado: toda vez que a tela carregava, o sistema comparava `1.6.0-rc2.7.58` (do `version.json`) com `1.6.0-rc2.7.57` (hardcoded no próprio bootstrap que acabou de carregar) — viam como diferentes, concluíam que havia uma versão nova disponível e chamavam `location.replace(...)` para recarregar a página com um novo parâmetro `_atualizado` na URL. Só que a página recarregada era a mesma versão quebrada, com a mesma constante desatualizada — então o ciclo se repetia infinitamente. Isso é exatamente o loop relatado: a tela fica carregando, a URL muda sozinha várias vezes (o parâmetro `_atualizado` muda a cada volta) e a tela pisca a cada recarregamento.
- Corrigido atualizando `APP_VERSION_CLEAN` e todas as demais constantes de versão por módulo dentro da pasta do release para `1.6.0-rc2.7.59`, e **adicionado um item de verificação ao processo de release** para nunca mais deixar esse valor desalinhado do `version.json`.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.58.
- Nenhuma mudança funcional além da correção do loop — o conteúdo da RC2.7.58 (comprador, telefone, discriminação do checkout) permanece igual.

## 1.6.0-rc2.7.58 — 27/10/2026

Base: **RC2.7.57**.

### Melhoria: experiência do link de pagamento (comprador, telefone, discriminação do checkout)

- **Modal de pagamento da conta familiar com campos mortos removidos**: `openAccountPaymentV141` (a versão que realmente carrega na tela, em `21-family-shared-experience.js`) tinha campos de nome/telefone/e-mail do comprador e um checkbox "Salvar dados" que pareciam funcionar, mas o botão de confirmação de verdade nunca lia esses campos — quem preenchia ali preenchia em vão. Os dados do comprador já são tratados depois, numa etapa dedicada (`checkoutBuyerStepV157`), que é a que realmente salva e pré-preenche. Removidos os campos mortos; o botão "Gerar pagamento InfinitePay" virou "Continuar" (igual à versão sem family-awareness), e recebeu de volta o `id="v157AccountContinue"` que tinha se perdido nessa versão — sem ele, o botão não mostrava o estado de carregando/desabilitado durante a geração do link.
- **Corrigido um bug real de normalização de telefone**: `normalizePhone` (servidor) decidia se um número já tinha o "+55" olhando só se ele começava com "55" — só que DDD 55 é uma área real (região de Santa Maria/RS), então um número local de 11 dígitos começando em 55 virava um número truncado e errado. Agora a decisão é pelo tamanho total do número (12 ou 13 dígitos = já tem código do país; 10 ou 11 = não tem), não pelo prefixo.
- A edição administrativa do comprador padrão da família (`editar_comprador_padrao`) salvava o telefone exatamente como digitado, sem normalizar — agora usa a mesma `normalizePhone` corrigida, mantendo o mesmo formato canônico em todo lugar que grava `dados_pagamento_responsavel`.
- **Checkout agora discrimina o que está sendo cobrado**: quando um link de pagamento (lanche, fardamento ou venda do catálogo pela secretaria) embute também um saldo em aberto antigo, o link gerado na InfinitePay deixava de informar: o pai via só um valor total, sem saber que uma parte era uma dívida antiga. Agora o link lista dois itens separados — a compra atual e a "Regularização de saldo em aberto" — em vez de um valor único sem explicação.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.57.

## 1.6.0-rc2.7.57 — 27/10/2026

Base: **RC2.7.56**.

### Melhoria: abas do perfil da família com mais detalhe (B4-B7)

- **Lanches**: a aba juntava só a programação de lanche (`ocorrencias_entrega`) e nunca mostrava o consumo avulso da cantina — era exatamente o ponto cego que escondia o risco de duplicidade que investigamos na auditoria da família do João Pedro. Agora os dois aparecem juntos, em ordem cronológica, com data **e hora**, o item e o valor — não só a data, como antes.
- **Pedidos**: ganhou um botão "Detalhar" (reaproveitando a tela de detalhe que já existia, agora também funcionando para pedidos operacionais — mensalidade, evento, negociação —, que antes não tinham suporte).
- **Movimentações**: reorganizada em blocos por dia, estilo extrato bancário — cada bloco mostra as transações daquele dia com o impacto de cada uma no saldo, e fecha com o "Saldo do dia" (o saldo da conta ao final daquele dia).
- **Pagamentos**: quando o pagamento tem uma movimentação correspondente (mesmo NSU), o "Detalhar" agora reaproveita o mesmo detalhamento completo de Movimentações (itens comprados + composição da forma de pagamento), em vez de mostrar só o valor total.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.56.

## 1.6.0-rc2.7.56 — 27/10/2026

Base: **RC2.7.55**.

### Princípio: categoria sempre vem do catálogo; crédito e regularização são mecanismo, não produto

- **Crédito adicionado deixou de contar como categoria de venda** no Relatório por categoria. Ele é uma forma de entrada de saldo, não um produto do catálogo — continua contando normalmente em "Por forma de pagamento" (onde o dinheiro realmente entrou e bate com o extrato do banco), mas não soma mais como se "Crédito" fosse algo vendido. O valor excluído aparece como um aviso separado no relatório ("Crédito adicionado sem produto vinculado no período"), para não desaparecer da visão geral.
- **Regularização de saldo já seguia esse princípio** desde a RC2.7.51 (sempre decomposta nas categorias reais do catálogo que causaram o saldo) — nenhuma mudança necessária aí.
- **"Lançar pendência anterior" agora exige escolher um item real do catálogo**, em vez de descrição livre + um dropdown genérico de tipo (Cantina/Fardamento/Mensalidade/Evento/Serviço/Negociação/Outro). Isso garante que todo lançamento retroativo — usado quando um lançamento da cantina é esquecido e precisa ser registrado depois — carregue a categoria real do catálogo, exatamente como uma venda ao vivo. O relatório passa a enxergar os dois de forma idêntica, sem nenhum tratamento especial para lançamento manual.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.55.

## 1.6.0-rc2.7.55 — 27/10/2026

Base: **RC2.7.54**.

### Correção: "Lançar pendência anterior" sumiu depois da reforma de ações (regressão da RC2.7.54)

- **Causa raiz**: a RC2.7.54 reorganizou os botões de ação da conta familiar para dentro de um menu "Ações", removendo a classe CSS `.v162-student-actions` do HTML. Só que o botão "Lançar pendência anterior" — usado quando um lançamento da cantina é esquecido e precisa ser registrado depois — não vivia nessa tela: ele era **injetado por um observador de mutações do DOM** que procurava essa classe específica. Quando a classe sumiu, o observador parou de encontrar onde injetar, e o botão desapareceu silenciosamente — sem erro, sem aviso.
- Corrigido colocando o botão diretamente no menu "Ações" (junto com "Gerar cobrança", "Registrar pagamento" etc.), em vez de depender de um observador externo adivinhar onde encaixá-lo. Esse botão abre o lançamento retroativo já com categoria (Lanche/Cantina, Fardamento, Mensalidade, Evento, Serviço, Negociação, Outro), fica como "aguardando pagamento" e pode gerar link de cobrança depois pela tela de Cobranças.
- O mesmo observador também reescrevia a aba Movimentações de forma assíncrona (consolidando compra+pagamento numa segunda passada, depois da primeira renderização já ter aparecido crua) — um forte candidato para o bug de "a tela mostra um formato, depois mostra outro" relatado na auditoria da família do João Pedro. Essa consolidação agora é feita direto na primeira renderização da aba, sem segunda passada.

### Melhoria: Agenda da cantina reorganizada por aluno, com o aviso de duplicidade sempre visível

- A lista anterior mostrava um card por lançamento, com colunas apertadas e o valor num texto pequeno e apagado — difícil de ler rapidamente.
- Agora a agenda agrupa tudo por aluno: um card por aluno no dia, com cada item e seu valor, mais o total do dia para aquele aluno.
- O aviso de consumo em duplicidade (RC2.7.53) deixou de depender só da confirmação ao clicar — agora, quando um aluno tem programação de lanche **e** consumo avulso no mesmo dia, isso aparece como um aviso visível direto no card, sem precisar clicar em nada.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.54.

## 1.6.0-rc2.7.54 — 27/10/2026

Base: **RC2.7.53**.

### Correção: duas telas diferentes para a conta do aluno (causa do "abre de um jeito, abre de outro")

- **Causa raiz confirmada**: o sistema tinha **duas implementações inteiras e concorrentes** da tela de conta do aluno — uma mais antiga (V162, cartões simples) e uma mais nova (V172, "Conta familiar", que junta compra+pagamento numa linha, mostra regularização embutida e tem o botão "Emitir PDF"). A maioria dos botões do sistema já apontava para a versão nova, mas um ponto específico — `openSystemEntityV165('aluno', id)`, usado sempre que você clica no **nome de um aluno** em qualquer lugar do sistema (inclusive nos próprios cartõezinhos de nome dentro da tela nova) — ainda chamava a versão antiga, pelo nome fixo. Agora esse ponto aponta para a mesma função que todo o resto do sistema já usa, então não existe mais "a outra tela" para cair.
- A implementação antiga (V162) não foi apagada nesta versão — ficou órfã (nada mais a chama), mas o código continua no repositório. A remoção definitiva fica para uma limpeza futura, depois de confirmar que nada mais depende dela.

### Correção: "Detalhar" de uma movimentação tirava você do perfil da família

- Antes, abrir o detalhe de uma movimentação de dentro da conta familiar e depois fechar aquele detalhe fechava a tela inteira — porque é tecnicamente a mesma janela reaproveitada, sem nenhuma forma de "voltar". Agora o botão de fechar (×), quando você abre um detalhe de dentro da conta familiar, vira "voltar para a conta familiar" em vez de fechar tudo.
- **Importante**: a tela da conta da família continua sendo uma janela flutuante (modal), não uma tela fixa dentro do menu como foi pedido — essa é uma mudança maior, de arquitetura de navegação, que fica para uma etapa seguinte. O que foi resolvido agora é especificamente a perda de contexto ao fechar um detalhe.

### Melhoria: ações da conta familiar agrupadas

- Os botões "Gerar cobrança", "Registrar pagamento", "Bloquear conta", "Editar responsável" etc. estavam todos soltos, lado a lado, poluindo a tela. Agora ficam agrupados sob um único botão "Ações ▾".

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.53.

## 1.6.0-rc2.7.53 — 27/10/2026

Base: **RC2.7.52**.

### Melhoria: alerta cruzado entre consumo avulso e programação de lanche

- **Causa raiz**: "Consumo na cantina" (venda avulsa no balcão) e "Programação de lanche" (pedido agendado, confirmado na Agenda da cantina) são dois sistemas que nunca se falam. Isso abre espaço para o mesmo lanche real ser registrado duas vezes — ex.: o aluno já consumiu algo avulso de manhã, e mais tarde o operador vê o nome dele pendente na Agenda e marca "Entregue" pensando que já serviu, quando na real pode ser a mesma refeição sendo contada de novo.
- Agora, antes de marcar uma entrega programada como Entregue/Ausente/Não entregue, o sistema verifica se o aluno já tem consumo avulso lançado no mesmo dia e, se tiver, mostra um aviso com o que já foi consumido (itens e valor) antes de deixar confirmar. O mesmo vale no sentido inverso: ao lançar um consumo avulso na cantina, se o aluno já tem uma entrega programada pendente ou entregue no dia, o operador é avisado antes de finalizar.
- O aviso **não bloqueia** a operação — é uma confirmação explícita, porque às vezes são mesmo dois itens diferentes no mesmo dia. O objetivo é dar ao operador a informação que falta para decidir, não travar o atendimento.
- Esse alerta, por si só, já ataca a causa da contagem duplicada de estoque de salgados (um salgado físico sendo descontado duas vezes do "disponíveis hoje" por ter sido lançado nos dois sistemas) — ao evitar o lançamento duplicado na origem, não é mais necessário reconciliar os números depois.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.52.

## 1.6.0-rc2.7.52 — 27/10/2026

Base: **RC2.7.51**.

### Melhoria: Gestão/Admin ganham acesso à Agenda da cantina

- A permissão técnica já existia, mas não havia botão no menu de Gestão/Admin para a página "Agenda da cantina" (entregar, marcar ausência, estornar). Agora ela aparece no menu desses dois perfis, junto de "Cantina".

### Melhoria: correção direta de entrega já finalizada, sem fila de aprovação

- **Antes**: quando uma entrega programada já tinha recebido uma situação final (Entregue/Ausente/Não entregue) e precisava ser corrigida, o único caminho era "Solicitar correção" — que apenas gravava um pedido numa coleção (`solicitacoes_correcao_pedido`) que **nenhuma tela do sistema jamais exibia**. Na prática, a correção nunca acontecia.
- **Agora**: qualquer perfil que já acesse a Agenda da cantina (inclusive o próprio operador da cantina, mesmo quando é ele quem cometeu o erro) pode corrigir a entrega na hora, trocando a situação final para outra (ex.: de "Entregue" para "Não entregue", ou vice-versa). A justificativa é **obrigatória** (mínimo de detalhe exigido) e fica gravada tanto no próprio registro da entrega quanto na Auditoria, com quem corrigiu, quando e o motivo.
- A correção recalcula o efeito financeiro e de estoque pela diferença entre a situação antiga e a nova (ex.: se estava "Entregue" — sem efeito financeiro — e vira "Não entregue", credita o valor de volta e libera o salgado reservado; se for o caminho inverso, estorna o crédito e reserva o salgado de novo), em vez de assumir sempre que não havia nenhum efeito anterior.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.51 — o acesso de equipe já é liberado por `staffActive()`, então nenhuma regra precisou mudar para habilitar a correção direta.

## 1.6.0-rc2.7.51 — 09/10/2026

Base: **RC2.7.50**.

### Melhoria: o Relatório por categoria agora mostra o que compõe cada "Regularização de saldo"

- **Pedido**: uma "Regularização de saldo" pode ter origens bem diferentes — uma mensalidade atrasada, um consumo na cantina, um passeio não pago — e o relatório só mostrava o valor regularizado numa categoria genérica, sem dizer o que, de fato, estava sendo quitado.
- A conta do aluno é um saldo corrente único (não existe uma "fatura" por compra), então o sistema não tinha, em lugar nenhum, a informação de "o que gerou esse saldo negativo". A partir de agora, toda vez que uma regularização aparece no relatório (seja feita na secretaria, seja embutida automaticamente numa venda online — RC2.7.50), o sistema reconstrói a origem andando pelo extrato do aluno: soma as compras e consumos mais recentes (mensalidade, cantina, passeio, farda, etc.) até explicar o valor regularizado, parando exatamente no ponto em que a conta esteve zerada da última vez — para nunca misturar com um ciclo de dívida antigo já quitado.
- Resultado: em vez de uma linha única "Regularização de saldo", o relatório agora mostra as categorias reais por trás dela (ex.: "Mensalidade R$ 30,00" + "Lanche / Cantina R$ 6,00"). Quando o histórico não é suficiente para explicar todo o valor (conta muito antiga, por exemplo), o restante aparece como "Regularização de saldo (origem não identificada no histórico)" — para o total nunca deixar de bater.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.50.

## 1.6.0-rc2.7.50 — 09/10/2026

Base: **RC2.7.49**.

### Correção: regularização de saldo paga junto com uma venda online da secretaria sumia do Relatório por categoria

- **Causa raiz**: quando a família (ou a secretaria em nome dela) paga uma venda pelo **link de pagamento online** (checkout da secretaria) e o aluno já tinha um saldo devedor em aberto, o sistema cobra os dois valores juntos num único link da InfinitePay — soma o preço do item (ex.: Passeio) com a dívida em aberto. Só que, ao salvar a venda, o campo "itens" grava apenas o produto comprado; o valor da regularização embutida nunca virava um item nem entrava no total da venda salva. Resultado: o relatório mostrava só o passeio (ex.: R$ 36,00) e a regularização paga junto — que já tinha saído de fato da InfinitePay — ficava invisível. Esse era exatamente o caso do José Otávio: o valor mostrado batia com o item, mas não com o que realmente foi cobrado no pagamento.
- O relatório agora reconstrói esse valor embutido a partir dos totais que a venda já guarda (valor recebido pela InfinitePay, valor bruto dos itens e valor de saldo usado) e o exibe como uma linha própria — **"Regularização de saldo (quitada junto com esta compra)"**, categoria **"Regularização de saldo"** — somada ao valor total do lançamento.
- Corrigido também um problema relacionado: vendas feitas por esse checkout online, quando pagas via InfinitePay, apareciam no relatório rotuladas como **"Saldo da conta"** na forma de pagamento (porque essas vendas não guardam a lista detalhada de pagamentos que as vendas presenciais guardam). Agora a parte paga pela InfinitePay aparece como tal, e só o valor efetivamente descontado do saldo do aluno aparece como "Saldo da conta".

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.49.

## 1.6.0-rc2.7.49 — 09/10/2026

Base: **RC2.7.48**.

### Correção: regularização de saldo e crédito manual não apareciam no Relatório por categoria

- **Causa raiz**: quando a secretaria registra uma "Regularização de saldo" ou um "Crédito adicionado" avulso (sem estar vinculado à compra de um item específico — ex.: a mãe quita uma dívida em aberto, sem comprar nada novo naquele lançamento), o sistema **não cria um documento de venda** para essa operação — só o lançamento financeiro na conta do aluno. Como o Relatório por categoria só lia a coleção de vendas, esses lançamentos simplesmente não apareciam — exatamente o caso relatado: a mãe pagou o passeio (apareceu) e regularizou o saldo da conta separadamente (não apareceu).
- O relatório agora também lê esses lançamentos financeiros sem venda vinculada e os inclui como categorias próprias — **"Regularização de saldo"** e **"Crédito adicionado"** — com a forma de pagamento completa (incluindo mesclado).

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.48.

## 1.6.0-rc2.7.48 — 09/10/2026

Base: **RC2.7.47**.

### Correção: faltava detalhamento em vários lugares e forma de pagamento mesclada não aparecia

- **Caixa da Secretaria**: os movimentos de "Venda em dinheiro" não mostravam nem o nome do aluno nem o que foi vendido — só o valor. Agora cada venda mostra o aluno e um resumo dos itens direto na tabela, além de um botão **"Detalhar"** para ver a composição completa.
- Corrigido um link quebrado: na tela de Gestão (Caixa integrado), o botão **"Venda"** de cada movimento não abria nada, porque usava um formato de identificador que não batia com o esperado. Agora abre corretamente os detalhes da venda.
- A função que abre os detalhes de uma venda agora funciona a partir de qualquer ID de venda, não só das que já estavam carregadas na tela de Vendas — então "Detalhar" passa a funcionar de forma confiável em qualquer lugar do sistema que mostre uma venda.
- **Extrato do aluno** (detalhe de uma movimentação): quando o pagamento foi mesclado (ex.: parte dinheiro, parte Pix), agora mostra a composição completa — antes só aparecia uma forma de pagamento genérica.
- **Relatório por categoria**: além do total por categoria, agora mostra também um quadro **"Por forma de pagamento"** (Dinheiro, Pix · InfinitePay, Cartão, Saldo da conta, etc.) com total de cada uma. O CSV detalhado também ganhou uma coluna com a composição do pagamento de cada venda (ex.: "Dinheiro R$ 60,00 + Pix · InfinitePay R$ 40,00") em vez de só "pagamento combinado".
- Corrigido rótulo que faltava para regularização manual de saldo na secretaria (antes aparecia sem tradução no extrato).

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.47.

## 1.6.0-rc2.7.47 — 06/10/2026

Base: **RC2.7.46**.

### Melhoria: categorias do Relatório por categoria agora seguem o catálogo da escola

- A RC2.7.46 agrupava tudo em 6 categorias fixas (Lanche, Farda, Mensalidade, **Passeio/Evento** — tudo junto —, Negociação, Outros). Isso misturava passeio, gincana e qualquer outro tipo de evento numa única linha.
- O relatório agora resolve a categoria de cada item pela **árvore de categorias do próprio catálogo** (a mesma usada em Catálogo de vendas). Resultado: cada categoria específica que a escola já cadastrou — por exemplo, uma "Gincana" e um "Passeio" criados como categorias diferentes dentro de Eventos — aparece **separada** no relatório, com o nome exato que está cadastrado.
- Produtos/Combos da Cantina continuam consolidados como **"Lanche / Cantina"** (nomes genéricos demais para servirem de categoria própria). Mensalidade, Negociação e Farda continuam com rótulos claros quando não há uma categoria mais específica cadastrada.
- Se quiser separar algo que hoje aparece junto (ex.: criar uma categoria "Gincana" específica dentro de Eventos), é só cadastrar essa categoria em **Catálogo de vendas** e usá-la nos itens — o relatório reflete automaticamente, sem precisar de nova alteração no sistema.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.46.

## 1.6.0-rc2.7.46 — 06/10/2026

Base: **RC2.7.45**.

### Novidade: Relatório de vendas por categoria (escrituração/conferência externa)

- Em **Cobranças e saldos**, novo botão **"Relatório por categoria"**.
- Escolhendo um período (data inicial e final), o sistema consolida todas as vendas confirmadas (já excluindo canceladas) em: **Lanche / Cantina**, **Farda**, **Mensalidade**, **Passeio / Evento**, **Negociação** e **Outros** — com total de lançamentos e valor por categoria.
- Vendas com carrinho misto (ex.: lanche + farda na mesma compra) são divididas item a item, não jogadas inteiras em uma única categoria.
- Botão **"Baixar lista detalhada (CSV)"** exporta cada item de cada venda (data, aluno, categoria, valor, forma de pagamento, canal, ID da venda) — pensado para conferência linha a linha contra extratos externos (ex.: relatório de movimentações da InfinitePay) antes de lançar em outro sistema de contabilidade/escrituração.
- Acesso restrito a Gestão, Secretaria e Admin.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada (ação nova dentro do handler já existente de `resumo-operacional`).
- Firestore Rules byte a byte iguais à RC2.7.45.

## 1.6.0-rc2.7.45 — 28/09/2026

Base: **RC2.7.44**.

### Correção: botão "Cancelar / Estornar" não aparecia para consumo de Cantina

- **Causa raiz**: o consumo lançado em "Lançar na conta do aluno" (Cantina) grava dois documentos — o movimento financeiro (`movimentos_conta`, o que aparece na aba Movimentações) e a venda (`vendas`, usada pelo fluxo de cancelamento). O movimento financeiro **nunca gravava o ID da venda vinculada** (`vendaId`). A tela de detalhe da movimentação usa esse campo para carregar a venda e decidir se mostra o botão "Cancelar / Estornar" — como o campo sempre vinha vazio, o botão adicionado na RC2.7.44 nunca aparecia para esse tipo de consumo, mesmo depois da correção anterior liberar o cancelamento no backend.
- **Correção**:
  - O consumo de Cantina agora grava `vendaId` corretamente no movimento financeiro, então novos lançamentos já saem prontos para cancelamento direto pela tela de Movimentações.
  - Para lançamentos **antigos** (já registrados antes desta correção, como o consumo indevido do dia 23/09), a tela de detalhe agora busca a venda correspondente automaticamente por aluno + data + valor quando o vínculo direto não existe, então o botão "Cancelar / Estornar" passa a aparecer também para eles.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.44.

## 1.6.0-rc2.7.44 — 28/09/2026

Base: **RC2.7.43**.

### Correção: não era possível estornar uma cobrança indevida da Cantina

- **Causa raiz**: o fluxo "Cancelar / Estornar" de uma venda (usado para corrigir vendas lançadas por engano ou duplicadas) só reconhecia vendas de origem `secretaria`/`secretaria_presencial`. Uma cobrança feita pela Cantina em "Lançar na conta do aluno" (ex.: um lanche cobrado por engano quando o aluno já tinha uma programação de lanche pagando o mesmo consumo) fica registrada com origem `cantina` e era **rejeitada** por esse fluxo com o erro "Esta venda não foi registrada como venda presencial da Secretaria...". Não havia nenhuma outra forma de reverter esse tipo de lançamento no sistema.
- O botão de confirmação também exigia declarar "nenhum item foi entregue", o que não fazia sentido para um consumo de cantina genuinamente entregue (o aluno comeu o lanche) — o problema nunca foi a entrega, foi a cobrança duplicada.
- **Correção**:
  - O cancelamento/estorno agora também aceita vendas de origem `cantina`, revertendo corretamente o débito na conta do aluno (e o estoque de salgado, se aplicável), sem mexer no caixa (esse tipo de consumo nunca movimenta caixa).
  - Para consumo de Cantina, a confirmação exigida passou a ser "Cobrança indevida ou duplicada" — mais honesta com o que realmente aconteceu — em vez de "nenhum item foi entregue".
  - O modo de reembolso (para dinheiro/Pix/cartão devolvido ao pagador) foi bloqueado para consumo de Cantina, já que esse tipo de venda é sempre pago com saldo da conta, nunca com pagamento externo.
  - A tela de **detalhe de uma movimentação** (extrato do aluno) agora mostra diretamente o botão **"Cancelar / Estornar"** quando a movimentação está ligada a uma venda cancelável — antes só existia esse botão na lista de Vendas, obrigando a Gestão/Secretaria a localizar a venda separadamente por ID.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.43.
- Nenhuma mudança de comportamento para o fluxo já existente de vendas da Secretaria.

## 1.6.0-rc2.7.43 — 17/09/2026

Base: **RC2.7.42**.

### Correção: botão de desbloqueio não aparecia para conta bloqueada pelo fechamento semanal

- **Causa raiz**: a tela que abre hoje ao clicar em um aluno (perfil / "Conta familiar") tem um botão único de bloquear/desbloquear conta. Ele só verificava a flag de bloqueio **manual** (`bloqueioManual`) para decidir o texto do botão e a ação — ignorando os outros dois motivos de bloqueio existentes no sistema: bloqueio automático do **fechamento semanal** (`bloqueioSaldoSemanal`) e bloqueio por **limite** (`bloqueadoPorLimite`). Resultado: uma conta bloqueada pelo fechamento semanal mostrava o selo "Conta bloqueada" no topo da tela, mas o botão logo abaixo continuava dizendo "Bloquear conta" (como se estivesse liberada) — sem nenhuma forma de desbloquear por ali.
- O botão agora usa a mesma verificação já usada no selo (`familyAccountBlockedV174`, que considera os três motivos de bloqueio). Com isso, sempre que a conta estiver bloqueada por qualquer motivo, o botão mostra **"Desbloquear conta"** e, ao clicar, remove os três bloqueios de uma vez (reaproveitando a função `toggleManualBlock` já existente desde a RC2.7.33).
- Essa é a tela alcançada tanto ao clicar diretamente no aluno quanto pelo botão "Ver conta" em **Cobranças**, então a correção cobre os dois caminhos.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.42.

## 1.6.0-rc2.7.42 — 14/09/2026

Base: **RC2.7.41**.

### Correção: venda em dinheiro duplicada no caixa sem duplicar no aluno

- **Causa raiz identificada**: em uma venda paga **100% em dinheiro** (sem usar saldo do aluno e sem gerar dívida), o saldo do aluno antes e depois da operação é matematicamente igual (o pagamento em dinheiro cobre exatamente o valor da compra). A trava de segurança existente no backend (`registerInPersonOperation`) só bloqueia uma segunda tentativa comparando o saldo do aluno antes/depois — e como esse saldo não muda nesse tipo de venda, uma segunda tentativa (duplo clique, nova tentativa após timeout de rede, ou reabertura do rascunho de venda salvo) passava pela trava sem ser barrada. O caixa em dinheiro (`movimentos_caixa`/`saldoEsperadoAtualCentavos`) é incrementado a cada chamada, então duplicava; a conta do aluno não mostrava duplicidade porque, mesmo duplicada, cada lançamento individual tinha efeito líquido zero no saldo dele.
- **Correção**: `registerInPersonOperation` agora aceita uma chave de idempotência (`operationId`) opcional enviada pelo front-end. Antes de aplicar qualquer efeito financeiro, a transação verifica se aquela operação já foi registrada; se já foi, a chamada é tratada como duplicata e nenhum novo lançamento é criado (nem venda, nem movimento de caixa, nem auditoria/notificação repetida).
- A tela **Vendas da secretaria** (venda presencial/online) agora gera um `operationId` estável por venda, inclusive quando o rascunho salvo automaticamente é retomado após um problema de conexão — evitando duplicar a mesma venda mesmo em reenvios manuais.
- O botão **Confirmar recebimento** de "Registrar pagamento presencial" (Caixa → conta do aluno) não tinha proteção contra duplo clique; agora desabilita durante o envio, como já acontece nas demais telas de operação financeira, e também usa a nova chave de idempotência.
- **Como corrigir uma venda que já foi duplicada antes desta correção**: abra a venda duplicada em **Vendas** → clique na venda → **Cancelar / Estornar** → **Pagamento não foi recebido / venda lançada por engano** → motivo **"Registro duplicado"**. Esse fluxo já existia no sistema e desfaz corretamente o efeito no caixa em dinheiro daquela venda específica, preservando a venda original.

### Preservado
- **10 funções serverless**; nenhuma função nova foi criada.
- Firestore Rules byte a byte iguais à RC2.7.41.
- Nenhuma mudança de comportamento para quem não envia `operationId` (compatibilidade retroativa total).

## 1.6.0-rc2.7.41 — 11/08/2026

Base: **RC2.7.40**.

### Hotfix: erro `Cannot read properties of null (reading 'id')` ao fechar pedido de lanche
- Causa: no fluxo de programar lanche para mais de um aluno numa mesma venda (`captureSaleSnackV172`/`captureParentSnackV172`), o aluno de destino não era encontrado e a função tentava montar o item do carrinho mesmo assim, quebrando ao ler `student.id` de um valor nulo.
- Corrigido com uma validação explícita, que agora mostra uma mensagem clara ("Não foi possível identificar o aluno desta programação...") em vez do erro técnico cru.
- Também reforçada a proteção contra duplo clique no botão "Adicionar ao carrinho"/"Revisar pedido" desse fluxo — não tinha nenhuma trava nas três camadas de função que esse botão atravessa, mesma categoria do bug já corrigido no caixa (RC2.7.38).

## 1.6.0-rc2.7.40 — 11/08/2026

Base: **RC2.7.39**.

### Hotfix: cancelar movimento não refletia direito no saldo nem na tela de gestão
- Causa raiz: `cashEffectV164` (tela da secretaria) e `v165CashEffect` (Auditoria do caixa, usada pela gestão) **recalculam** o efeito de cada movimento a partir do tipo/valor toda vez que a tela é montada — nenhuma delas sabia que um movimento podia estar marcado como cancelado. Resultado: mesmo com o campo de saldo já ajustado na hora do cancelamento (RC2.7.38), qualquer nova consulta — inclusive a própria tela da secretaria depois de atualizar — recontava o movimento cancelado como se estivesse ativo, e a tela de gestão nunca teve nenhuma noção de cancelamento.
- As duas funções agora retornam efeito zero para um movimento cancelado, então o saldo esperado, entradas, saídas, sangrias e despesas ficam corretos em qualquer tela que consultar os movimentos, de forma consistente.
- A tabela de auditoria da gestão agora também mostra visualmente quando um movimento foi cancelado (selo "Cancelado", valor original riscado, e quem/quando cancelou) — antes ela não distinguia em nada um movimento cancelado de um ativo.

## 1.6.0-rc2.7.39 — 11/08/2026

Base: **RC2.7.38**.

### Hotfix urgente: "Caixa da Secretaria" não abria (`safeJs is not defined`)
- Regressão introduzida na RC2.7.38: o botão "Cancelar" adicionado à lista de movimentos usava uma função (`safeJs`) que existe em outros arquivos do sistema, mas não nesse — cada arquivo só enxerga suas próprias funções internas, então a tela inteira quebrava ao tentar montar a lista de movimentos.
- Corrigido usando o mesmo padrão que o próprio arquivo já usa em outros botões (inserir o ID do Firestore direto, sem função de escape — são IDs gerados pelo sistema, sempre seguros).

## 1.6.0-rc2.7.38 — 11/08/2026

Base: **RC2.7.37**.

### Hotfix: sangria/movimento de caixa duplicado ao clicar duas vezes
- Diagnóstico: **foi falha do sistema, não erro da secretária.** O botão "Confirmar saída"/"Confirmar entrada" não tinha nenhuma proteção contra clique duplo — cada clique disparava um lançamento novo e independente. Se o clique parecesse não ter respondido (rede lenta, etc.) e a pessoa clicasse de novo, o sistema registrava dois movimentos idênticos sem nenhum aviso.
- Corrigido: o botão agora desabilita e mostra "Registrando..." assim que clicado, e só volta a ficar disponível se der erro.

### Melhoria: cancelar um lançamento manual de caixa antes de fechar
- Adicionada a opção **"Cancelar"** em cada entrada/saída manual (sangria, despesa, entrada manual) na tela "Caixa da Secretaria", disponível enquanto o caixa está aberto e você é o responsável atual.
- Cancelar ajusta o saldo esperado do caixa na hora e marca o lançamento como "Cancelado" na lista — o registro não é apagado (fica visível e sinalizado, preservando a auditoria), e o valor deixa de contar no saldo. Movimentos gerados pelo próprio sistema (vendas, abertura de caixa, estornos) não aparecem com essa opção, só os lançamentos manuais.

## 1.6.0-rc2.7.37 — 11/08/2026

Base: **RC2.7.36**.

### Hotfix: vendas lançadas pela cantina na conta do aluno apareciam sem o nome
- `registerAccountConsumption` (tela "Lançar na conta do aluno", usada pelo operador da cantina em Atendimento) gravava a venda e o movimento financeiro só com o `alunoId` — sem o nome, turma ou matrícula do aluno. A lista de Vendas usa o nome como referência principal e só cai pro ID interno quando não acha nada; sem o nome gravado e sem a lista de alunos carregada, ela mostrava algo como "aluno_250603" no lugar do nome. O nome que aparecia embaixo (ex: "Ruan de Jesus Silva") era o **operador da cantina**, não o aluno.
- Corrigido: a venda e o movimento agora gravam nome, turma e matrícula do aluno, do mesmo jeito que os outros fluxos de venda já fazem.
- Reforço geral: `ensureStaffCommerceV221` (usada antes de abrir Vendas, Produtos, Configurações e Atendimento) agora também garante que a lista de alunos está carregada, então mesmo vendas antigas sem o nome gravado direto no registro vão exibir o nome certo pelo cadastro do aluno, em vez de cair no ID.

## 1.6.0-rc2.7.36 — 11/08/2026

Base: **RC2.7.35**.

### Hotfix: perfil do aluno sem nome ao abrir pela Auditoria do caixa
- Ao abrir "Auditoria do caixa" → "Períodos de responsabilidade" → clicar em "Aluno" numa movimentação, o perfil que abria mostrava o ID interno do aluno no lugar do nome, e turma/matrícula em branco — porque essa tela nunca garantia que a lista de alunos (`state.students`) estivesse carregada antes de tentar montar o perfil.
- `openStudentDetailsV162` (o perfil correto/único usado em todo o sistema — não existe um "perfil diferente", era esse mesmo, só sem os dados do aluno carregados) agora garante que a lista de alunos está carregada antes de montar a tela, não importa de qual tela você chegou até ele.
- A tela de auditoria de caixa também passa a carregar essa lista antes de montar a tabela de movimentações, então os links "Aluno" já mostram o nome certo, não um rótulo genérico.

## 1.6.0-rc2.7.35 — 11/08/2026

Base: **RC2.7.34**.

### Hotfix: tela de Pedidos não sincronizava as baixas da cantina para secretaria/gestão
- `loadUnifiedOrdersV166` (tela "Pedidos" usada por secretaria/gestão) só busca dados novos do Firestore na primeira vez que é aberta na sessão. Depois disso, nenhuma ação — nem mesmo a própria secretaria mudando o status de um pedido — forçava uma nova busca; a tela só redesenhava o que já estava em memória. Resultado: quando a cantina dava baixa numa entrega, quem já tinha essa tela carregada só via a atualização recarregando a página inteira.
- Adicionado um botão **"Atualizar"** no topo da tela de Pedidos.
- As ações que mudam o status de um pedido (secretaria atualizando fardamento/serviço, cantina confirmando ou não uma entrega) agora forçam a lista a buscar dado novo em vez de só redesenhar o estado antigo.

## 1.6.0-rc2.7.34 — 11/08/2026

Base: **RC2.7.33**.

### Hotfix: lista de Cobranças/contas bloqueadas incompleta e sem opção de Relatório
- `loadAllFinancialAccountsV221` (usada pela tela de Cobranças ao filtrar "Contas bloqueadas" ou "Saldo em aberto") só consultava a coleção `contas_responsaveis` (contas de família já consolidada). Alunos cuja conta ainda está em `contas_alunos` — sem responsável financeiro vinculado — ficavam completamente de fora da lista, não importa o quanto estivessem bloqueados ou negativos. A função agora busca as duas coleções e junta o resultado.
- Adicionado o botão **"Relatório"** direto nas linhas da lista de Cobranças (contas com saldo em aberto/bloqueadas), do mesmo jeito que já existe dentro da tela "Ver conta" — antes era preciso abrir a conta do aluno individualmente pra chegar até essa opção.

## 1.6.0-rc2.7.33 — 11/08/2026

Base: **RC2.7.32**.

### Hotfix: "Remover bloqueio" não desbloqueava de verdade
- Uma conta pode ficar bloqueada por três motivos independentes: bloqueio manual da secretaria, limite de fiado estourado numa compra, ou bloqueio do fechamento semanal. O botão existente só desligava o bloqueio manual — se o motivo fosse um dos outros dois, a conta continuava bloqueada mesmo depois de clicar em "Remover bloqueio".
- O botão na tela de conta do aluno agora mostra "Desbloquear conta" sempre que há qualquer tipo de bloqueio ativo, e ao clicar limpa os três motivos de uma vez — pensado justamente para o caso de uma negociação/decisão interna liberar o aluno independente da causa original do bloqueio.

## 1.6.0-rc2.7.32 — 11/08/2026

Base: **RC2.7.31**.

### Melhoria: link de pagamento junto com o Relatório de valores em aberto
- Investigado o relato de que o PDF "não emite" para alunos com conta bloqueada: o PDF sempre foi gerado normalmente (sem erro), mas o link dentro dele apontava só para a página inicial genérica do Meu Piaget — sem nenhum link de pagamento de verdade.
- O único lugar que já reunia PDF + link de regularização lado a lado era o painel de Fechamento semanal, que só cobre contas que passaram por aquele fechamento — uma conta bloqueada no meio da semana por estourar o limite numa compra não aparecia lá até o próximo fechamento.
- Adicionado o botão **"Gerar link de pagamento"** na tela de Relatório (`generateReport`, disponível para qualquer aluno com saldo em aberto, bloqueado ou não), reaproveitando a mesma função que já gera o link no painel semanal (`openAccountPaymentV141`). O link não foi embutido dentro do PDF em si — ele expira em 24h e o PDF pode ficar salvo/impresso por mais tempo que isso; o botão gera um link novo, sempre válido, no momento em que é clicado.

## 1.6.0-rc2.7.31 — 11/08/2026

Base: **RC2.7.30**.

### Hotfix: autorização de consumo da secretaria não chegava na cantina
- A tela "Autorização de consumo" (usada pela secretaria/gestão para liberar um aluno a consumir sem saldo, até um limite) só gravava os campos `consumoCreditoAutorizado`/`limiteConsumoCentavos` no cadastro do aluno.
- A checagem real feita no caixa da cantina (`registerAccountConsumption`) e o resumo de conta em qualquer tela (`getAccount`) sempre leram `autorizadoSemSaldo`/`limiteFiadoCentavos` da conta financeira — um documento e campos completamente diferentes, nunca atualizados por essa tela.
- Resultado: a secretaria autorizava, via o toast de sucesso parecia ter funcionado, mas a cantina continuava vendo a conta bloqueada (ou com o limite antigo).
- `/api/gestao-familias` (`configurar_consumo_aluno`) agora espelha a autorização/limite na conta financeira do aluno na mesma chamada, exatamente como a permissão dada pelo próprio responsável no Meu Piaget já fazia. Continua respeitando a regra existente: se o responsável já assumiu o controle da autorização pelo Meu Piaget, a escola não pode mais sobrescrevê-la.

## 1.6.0-rc2.7.30 — 11/08/2026

Base: **RC2.7.29**.

### Hotfix: perfil cantina sem produtos no Atendimento
- A otimização de leitura que decide quais páginas pré-carregam o catálogo de produtos antes de renderizar (`STAFF_COMMERCE_PAGES`, introduzida na RC2.7.25) incluía `vendas`, `produtos` e `config`, mas não `atendimento` — a tela principal do perfil cantina. Resultado: o catálogo nunca era carregado para esse perfil, deixando "Venda rápida em dinheiro" e "Lançar na conta do aluno" sem nenhum produto pra selecionar.
- `atendimento` foi adicionado à lista de páginas que pré-carregam o catálogo.

## 1.6.0-rc2.7.29 — 11/08/2026

Base: **RC2.7.28**.

### Hotfix: histórico de Vendas da secretaria "travando"/mostrando poucos registros
- Trocar de aba no histórico de vendas (Todas/Presenciais/Online/Pendentes/Concluídas/Canceladas) descartava toda a paginação já carregada e buscava só os 50 registros mais recentes de cada fonte (vendas, links online, checkouts) de novo — inclusive ao voltar para "Todas". Agora a troca de aba é só um filtro em cima do que já foi carregado, sem nova consulta ao Firestore.
- Ao finalizar uma venda nova, a tela às vezes não buscava dado novo e só redesenhava o que já estava em memória. Agora a confirmação de uma venda força a atualização real da lista.
- Reduz de forma relevante o volume de leituras do Firestore nessa tela, já que trocar de aba deixou de custar uma nova consulta.

### Hotfix: fechar/cancelar "Nova venda" caía numa página de vendas errada
- O botão de fechar (X) e o de cancelar do assistente de nova venda chamavam uma versão antiga da tela de vendas (sem abas/filtro), diferente da que é exibida normalmente. Agora usam a mesma função da tela atual, preservando a aba em que o usuário estava — igual já acontecia ao concluir uma venda com sucesso.

### Hotfix: lançamento manual/retroativo não fechava como pago
- Quando uma pendência manual/retroativa era paga (link de regularização de saldo), o saldo da família era creditado corretamente, mas o lançamento e o pedido de origem continuavam marcados como "aguardando pagamento" para sempre.
- Ao confirmar um pagamento de entrada de conta (`entrada_conta_aluno`, InfinitePay ou reconciliação manual), o servidor agora busca as pendências manuais em aberto daquele aluno e quita as mais antigas primeiro, até o valor pago se esgotar, marcando `lançamentos_manuais`, o pedido de origem (`pedidos_operacionais`/`pedidos_farda`) e o movimento de conta correspondentes como `pago` na mesma transação do crédito de saldo.
- Consulta limitada e pontual (só no momento da confirmação do pagamento), sem impacto relevante no volume de leituras do Firestore.

## 1.6.0-rc2.7.28 — 11/08/2026

Base: **RC2.7.27**.

### Hotfix: venda presencial de fardamento
- Corrigido `ReferenceError: nome is not defined` em `addUniformStockRequirement()`.
- O requisito de estoque da farda agora grava corretamente `nome: name`.
- Incluído teste de execução da normalização de uma venda presencial de camisa, com preço e estoque de variação simulados.

### Hotfix: Cancelar / Estornar
- Corrigido `ReferenceError: detalhes is not defined` no envio do cancelamento pelo frontend.
- O campo visual `details` agora é enviado ao backend como `detalhes: details`.
- Preservado o fluxo da RC2.7.26 para corrigir, durante o cancelamento, entrega marcada como `entregue` por engano.

### Meu Piaget: leitura familiar segura pelo backend
- Criada uma camada de dados do portal dentro da função física já existente `/api/familias`, via `?modulo=dados`.
- A sessão familiar HttpOnly é validada no servidor; o servidor deriva novamente o responsável e os alunos vinculados e não confia em IDs enviados pelo navegador para definir propriedade dos dados.
- Movimentações/histórico, pedidos, pagamentos pendentes, avisos da página inicial, programação de lanches e notificações passam a usar a camada familiar segura onde havia consultas diretas suscetíveis a `Missing or insufficient permissions`.
- Abrir notificação, marcar uma notificação como lida e marcar todas como lidas também passam pelo backend no Meu Piaget.
- Acesso da equipe continua usando os caminhos já existentes; a mudança é específica ao modo responsável.
- Nenhuma Firestore Rule foi ampliada para contornar o erro.

### Infraestrutura preservada
- 10 funções físicas em `/api` — abaixo do limite de 12 observado no Vercel Hobby.
- `firestore.rules` byte a byte igual à RC2.7.27.
- Marco Zero não alterado.
- Núcleo de checkout/InfinitePay e webhook não alterados.
- Consolidação de endpoints da RC2.7.25 preservada.
