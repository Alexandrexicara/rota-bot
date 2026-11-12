const express = require('express');
const djenHandler = require('./api/djen');
const app = express();
app.disable('x-powered-by');
app.get('/api/djen', (req, res) => djenHandler(req, res));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, service: 'rota-bot-djen-proxy' }));
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log('DJEN proxy listening on', port));
