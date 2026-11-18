const { Pool, types } = require('pg');
require('dotenv').config();

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Date objects,
// so a reading's calendar day never shifts with server timezone.
types.setTypeParser(1082, (value) => value);

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
