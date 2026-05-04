const express = require('express');
const router = express.Router();
const { getPool } = require('../lib/db');
const { verifyToken } = require('./auth');

// Get all scripts (public)
router.get('/', async (req, res) => {
  const { search, category, page = 1, limit = 12, sort = 'newest' } = req.query;
  const offset = (page - 1) * limit;
  const pool = getPool();

  try {
    let where = "WHERE s.status = 'active'";
    const params = [];

    if (search) {
      where += ' AND (s.title LIKE ? OR s.description LIKE ? OR s.tags LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (category && category !== 'all') {
      where += ' AND s.category = ?';
      params.push(category);
    }

    const orderMap = {
      newest: 's.created_at DESC',
      oldest: 's.created_at ASC',
      popular: 's.download_count DESC',
      views: 's.view_count DESC'
    };
    const orderBy = orderMap[sort] || orderMap.newest;

    const [scripts] = await pool.execute(
      `SELECT s.*, u.username, u.avatar 
       FROM script s 
       LEFT JOIN user u ON s.user_id = u.id 
       ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM script s ${where}`, params
    );

    res.json({ scripts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single script
router.get('/:id', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const [scripts] = await pool.execute(
      `SELECT s.*, u.username, u.avatar 
       FROM script s LEFT JOIN user u ON s.user_id = u.id 
       WHERE s.id = ? AND s.status = 'active'`,
      [req.params.id]
    );

    if (scripts.length === 0) return res.status(404).json({ error: 'Script not found' });

    // Track view (once per IP per hour)
    const [recentView] = await pool.execute(
      `SELECT id FROM script_views 
       WHERE script_id = ? AND ip_address = ? AND viewed_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [req.params.id, ip]
    );

    if (recentView.length === 0) {
      await pool.execute(
        'INSERT INTO script_views (script_id, ip_address) VALUES (?, ?)',
        [req.params.id, ip]
      );
      await pool.execute(
        'UPDATE script SET view_count = view_count + 1 WHERE id = ?',
        [req.params.id]
      );
      scripts[0].view_count += 1;
    }

    res.json(scripts[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload script (authenticated)
router.post('/', verifyToken, async (req, res) => {
  const { title, description, category, tags, file_content, file_name, image } = req.body;

  if (!title || !description || !file_content)
    return res.status(400).json({ error: 'Title, description, and file content are required' });

  const pool = getPool();
  try {
    const status = req.user.role === 'admin' ? 'active' : 'pending';
    const [result] = await pool.execute(
      `INSERT INTO script (title, description, category, tags, file_content, file_name, image, user_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, category || 'general', tags || '', file_content, file_name || 'script.js', image || null, req.user.id, status]
    );

    res.status(201).json({
      message: status === 'active' ? 'Script uploaded successfully' : 'Script submitted for review',
      id: result.insertId,
      status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download script
router.get('/:id/download', async (req, res) => {
  const pool = getPool();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const token = req.headers['authorization']?.split(' ')[1];
  let userId = null;

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {}
  }

  try {
    const [scripts] = await pool.execute(
      "SELECT * FROM script WHERE id = ? AND status = 'active'", [req.params.id]
    );

    if (scripts.length === 0) return res.status(404).json({ error: 'Script not found' });

    const script = scripts[0];

    // Track download
    await pool.execute(
      'INSERT INTO script_downloads (script_id, ip_address, user_id) VALUES (?, ?, ?)',
      [req.params.id, ip, userId]
    );
    await pool.execute(
      'UPDATE script SET download_count = download_count + 1 WHERE id = ?',
      [req.params.id]
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${script.file_name || script.title.replace(/\s+/g, '-') + '.js'}"`);
    res.send(script.file_content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get realtime stats for a script
router.get('/:id/stats', async (req, res) => {
  const pool = getPool();
  try {
    const [[script]] = await pool.execute(
      'SELECT view_count, download_count FROM script WHERE id = ?', [req.params.id]
    );
    if (!script) return res.status(404).json({ error: 'Not found' });

    const [[todayViews]] = await pool.execute(
      'SELECT COUNT(*) as count FROM script_views WHERE script_id = ? AND DATE(viewed_at) = CURDATE()',
      [req.params.id]
    );
    const [[todayDownloads]] = await pool.execute(
      'SELECT COUNT(*) as count FROM script_downloads WHERE script_id = ? AND DATE(downloaded_at) = CURDATE()',
      [req.params.id]
    );

    res.json({
      total_views: script.view_count,
      total_downloads: script.download_count,
      today_views: todayViews.count,
      today_downloads: todayDownloads.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories
router.get('/meta/categories', async (req, res) => {
  const pool = getPool();
  try {
    const [cats] = await pool.execute(
      "SELECT category, COUNT(*) as count FROM script WHERE status = 'active' GROUP BY category ORDER BY count DESC"
    );
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
