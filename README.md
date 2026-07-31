# Escola Piaget — Sistema de Vendas V1.5.0-dev4-clean

Revisão da base modular limpa, com foco em checkout, uso opcional do saldo e navegação mobile interna.

## Destaques

- Uso do saldo positivo opcional e desativado por padrão em Cantina, Fardamento e Secretaria.
- Saldo negativo exige regularização junto com a compra.
- Menu mobile estático no cabeçalho para perfis internos.
- Tentativa de checkout idempotente para evitar links e pedidos duplicados.
- Status `preparando_link` só muda para `aguardando_pagamento` quando a URL existe.
- Área Pagamentos pendentes no portal, com retomada do checkout.
- Reserva de cantina continua em 5 minutos.
- Medição de tempo da preparação interna e da chamada à InfinitePay.
- Timeout controlado sem alterar o payload oficial da InfinitePay.

## Implantação

Suba o conteúdo completo deste diretório para um Preview da Vercel, mantendo as mesmas Environment Variables da versão validada. Não substitua a produção antes do roteiro de testes.

## Pasta de identidade visual

O pacote mantém as referências já existentes à pasta `assets/`. Ao aplicar esta versão sobre o projeto, preserve a pasta `assets/` atualmente usada na Vercel/Git, pois os arquivos de logo não estavam incluídos nos materiais-base desta conversa.
