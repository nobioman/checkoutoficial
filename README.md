# API de checkout Pix — InvictusPay (versão compatível com instalação simples)

## Requisitos
Node.js 20+ e VS Code.

## Instalação no Windows PowerShell
1. Extraia o ZIP e abra a pasta no VS Code.
2. Execute `npm.cmd install` (usa npm.cmd para contornar a política que bloqueia npm.ps1).
3. Copie `.env.example` para `.env`.
4. Configure a chave da API localmente em `.env`, sem compartilhá-la.
5. Configure o nome e o preço do produto em centavos (`2990` = R$ 29,90).
6. Execute `npm.cmd run dev`.
7. Abra `http://localhost:3000/health`.

## Rotas
- GET `/health`
- POST `/api/orders` com `{ "customer": { "name": "...", "email": "...", "document": "...", "phone": "..." } }`
- GET `/api/orders/:id`
- POST `/api/webhooks/invictuspay` (formato do webhook ainda precisa ser confirmado na documentação do gateway).

O valor vem da variável de ambiente no servidor, não do navegador. A chave do gateway deve permanecer no backend.

## Importante
Esta é uma base de desenvolvimento. Confirmar os campos reais da resposta de criação e o formato/autenticação do webhook com a InvictusPay antes de produção. O arquivo JSON é adequado apenas para desenvolvimento local simples; para produção ou múltiplas instâncias use banco persistente adequado (por exemplo PostgreSQL), HTTPS, validação de webhook, idempotência, monitoramento e revisão de segurança. Não liberar produto com base em status enviado pelo navegador.
