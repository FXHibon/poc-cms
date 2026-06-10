const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./index');

async function initializeDatabase() {
  console.log('Initializing database...');
  const sqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    // Execute schema queries
    await db.query(sql);
    console.log('Database tables created and default settings/pages seeded.');

    // Check if an admin user already exists
    const res = await db.query('SELECT * FROM users LIMIT 1');
    if (res.rows.length === 0) {
      // Create default admin user
      const defaultUsername = 'admin';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
      const isDefault = defaultPassword === 'admin';

      if (isDefault) {
        console.warn('WARN: Using the default admin password');
      }

      const passwordHash = bcrypt.hashSync(defaultPassword, 10);

      await db.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
        [defaultUsername, passwordHash]
      );
      console.log('--------------------------------------------------');
      console.log('Default Administrator Created:');
      console.log(`Username: ${defaultUsername}`);
      if (isDefault) {
        console.log('Password: [DEFAULT]');
      } else {
        console.log(`Password: ${defaultPassword}`);
      }
      console.log('--------------------------------------------------');
    } else {
      console.log('Administrator user already exists.');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await db.pool.end();
    console.log('Database connection pool closed.');
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
