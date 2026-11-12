# Proxy brasileiro do DJEN para o Rota Bot

Este pequeno serviço encaminha consultas somente para a API oficial do DJEN/CNJ. Ele precisa ser publicado na região Vercel gru1 (São Paulo), pois a consulta direta feita pelo ambiente Netlify atual está retornando HTTP 403.

## Publicação

1. Crie um projeto na Vercel conectado a este repositório.
2. Configure Root Directory como djen-proxy.
3. Mantenha a região da função em São Paulo (gru1), definida em vercel.json.
4. Crie a variável DJEN_PROXY_SECRET com um segredo aleatório forte.
5. Publique e copie a URL pública da função: https://SEU-PROJETO.vercel.app/api/djen.

## Variáveis no Netlify

No site rota-bots, configure:

- DJEN_PROXY_URL: URL completa da função Vercel, terminando em /api/djen.
- DJEN_PROXY_SECRET: exatamente o mesmo segredo configurado na Vercel.

Depois, publique novamente o site Netlify.

## Segurança e limites

- O proxy exige o cabeçalho secreto x-proxy-secret.
- Só encaminha parâmetros conhecidos da consulta de comunicações do DJEN.
- Não recebe URLs arbitrárias e não permite escolher outro host.
- Não contorna limites de uso do CNJ; respeite os cabeçalhos e eventuais respostas HTTP 429.
- O DJEN retorna publicações/comunicações, não a íntegra de todos os processos judiciais.
