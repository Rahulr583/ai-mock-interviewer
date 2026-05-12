const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// runs once on server start - creates all tables
async function initDB() {
  try {
    const conn = await pool.getConnection();
    console.log('MySQL connected');

    // users table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // interview sessions table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        job_role VARCHAR(100) NOT NULL,
        difficulty VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'active',
        score DECIMAL(4,2) DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // questions table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        question_text TEXT NOT NULL,
        q_number INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // answers table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS answers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        question_id INT NOT NULL,
        answer_text TEXT NOT NULL,
        feedback TEXT,
        score DECIMAL(4,2) DEFAULT 0,
        answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      )
    `);

    conn.release();
    console.log('All tables ready');
  } catch (err) {
    console.log('DB init error:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, initDB };
