const mysql = require('mysql2/promise');

let pool;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
};

const initDB = async () => {
  const conn = await getPool().getConnection();
  try {
    // Create users table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255),
        email VARCHAR(100) UNIQUE NOT NULL,
        avatar VARCHAR(500) DEFAULT NULL,
        google_id VARCHAR(255) DEFAULT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create scripts table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS script (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        image VARCHAR(500) DEFAULT NULL,
        file_content LONGTEXT,
        file_name VARCHAR(200),
        tags VARCHAR(500),
        user_id INT,
        download_count INT DEFAULT 0,
        view_count INT DEFAULT 0,
        status ENUM('active', 'pending', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
      )
    `);

    // Create views tracking table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS script_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        script_id INT NOT NULL,
        ip_address VARCHAR(45),
        user_id INT DEFAULT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES script(id) ON DELETE CASCADE
      )
    `);

    // Create downloads tracking table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS script_downloads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        script_id INT NOT NULL,
        ip_address VARCHAR(45),
        user_id INT DEFAULT NULL,
        downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES script(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Database initialized successfully');
  } finally {
    conn.release();
  }
};

module.exports = { getPool, initDB };
