const { getPool } = require('../lib/db');

const clients = new Map();

module.exports = async (req, res) => {
  const { scriptId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = Date.now();
  if (!clients.has(scriptId)) clients.set(scriptId, new Map());
  clients.get(scriptId).set(clientId, res);

  const sendStats = async () => {
    try {
      const pool = getPool();
      const [[script]] = await pool.execute(
        'SELECT view_count, download_count FROM script WHERE id = ?', [scriptId]
      );
      if (script) {
        const data = JSON.stringify({
          views: script.view_count,
          downloads: script.download_count,
          timestamp: new Date().toISOString()
        });
        res.write(`data: ${data}\n\n`);
      }
    } catch (err) {
      console.error('SSE error:', err);
    }
  };

  await sendStats();
  const interval = setInterval(sendStats, 5000);

  req.on('close', () => {
    clearInterval(interval);
    if (clients.has(scriptId)) {
      clients.get(scriptId).delete(clientId);
      if (clients.get(scriptId).size === 0) clients.delete(scriptId);
    }
  });
};
