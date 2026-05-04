const express = require('express');
const router = express.Router();
const { getPool } = require('../lib/db');
const { verifyToken } = require('./auth');

// Admin middleware
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Get dashboard stats
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  const pool = getPool();
  try {
    const [[totalScripts]] = await pool.execute("SELECT COUNT(*) as count FROM script");
    const [[activeScripts]] = await pool.execute("SELECT COUNT(*) as count FROM script WHERE status = 'active'");
    const [[pendingScripts]] = await pool.execute("SELECT COUNT(*) as count FROM script WHERE status = 'pending'");
    const [[totalUsers]] = await pool.execute("SELECT COUNT(*) as count FROM user");
    const [[totalDownloads]] = await pool.execute("SELECT SUM(download_count) as total FROM script");
    const [[totalViews]] = await pool.execute("SELECT SUM(view_count) as total FROM script");

    // Downloads in last 7 days
    const [weeklyDownloads] = await pool.execute(
      `SELECT DATE(downloaded_at) as date, COUNT(*) as count 
       FROM script_downloads 
       WHERE downloaded_at > DATE_SUB(NOW(), INTERVAL 7 DAY) 
       GROUP BY DATE(downloaded_at) ORDER BY date`
    );

    res.json({
      total_scripts: totalScripts.count,
      active_scripts: activeScripts.count,
      pending_scripts: pendingScripts.count,
      total_users: totalUsers.count,
      total_downloads: totalDownloads.total || 0,
      total_views: totalViews.total || 0,
      weekly_downloads: weeklyDownloads
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all scripts (admin)
router.get('/scripts', verifyToken, isAdmin, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const pool = getPool();
  const offset = (page - 1) * limit;

  try {
    let where = '';
    const params = [];
    if (status && status !== 'all') {
      where = 'WHERE s.status = ?';
      params.push(status);
    }

    const [scripts] = await pool.execute(
      `SELECT s.*, u.username FROM script s 
       LEFT JOIN user u ON s.user_id = u.id 
       ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM script s ${where}`, params
    );

    res.json({ scripts, total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update script status
router.patch('/scripts/:id', verifyToken, isAdmin, async (req, res) => {
  const { status, title, description, category } = req.body;
  const pool = getPool();

  try {
    const updates = [];
    const params = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (title) { updates.push('title = ?'); params.push(title); }
    if (description) { updates.push('description = ?'); params.push(description); }
    if (category) { updates.push('category = ?'); params.push(category); }

    if (updates.length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    await pool.execute(`UPDATE script SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Script updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete script
router.delete('/scripts/:id', verifyToken, isAdmin, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM script WHERE id = ?', [req.params.id]);
    res.json({ message: 'Script deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  const pool = getPool();
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, role, avatar, created_at FROM user ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user role
router.patch('/users/:id', verifyToken, isAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  const pool = getPool();
  try {
    await pool.execute('UPDATE user SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'User role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
