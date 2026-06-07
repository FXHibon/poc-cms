const { Pool } = require('pg');
require('dotenv').config();

// Standard connection options
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/novacms';

const pool = new Pool({
  connectionString,
  // Automatically shut down connection after some inactivity
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
