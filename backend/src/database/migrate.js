/**
 * Database Migration Script
 * Run this to set up the database schema
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function migrate() {
  try {
    console.log('Starting database migration...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
