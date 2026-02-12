/**
 * Database Seed Script
 * Creates initial test data
 */
require('dotenv').config();
const { query } = require('./connection');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  try {
    console.log('Seeding database...');

    // Create test tenant
    const tenantResult = await query(
      `INSERT INTO tenants (name, domain, data_region, hosting_type, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (domain) DO UPDATE SET name = $1
       RETURNING *`,
      ['Test Tenant', 'test.innovate-solutions.com', 'us-east-1', 'cloud', 'active']
    );

    const tenant = tenantResult.rows[0];
    console.log('Created tenant:', tenant.name);

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const adminResult = await query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = $3
       RETURNING *`,
      [tenant.id, 'admin@test.com', adminPasswordHash, 'Admin', 'User', 'buyer_admin', 'active']
    );

    console.log('Created admin user:', adminResult.rows[0].email);

    // Create test vendor
    const vendorResult = await query(
      `INSERT INTO vendors (tenant_id, vendor_code, name, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, vendor_code) DO NOTHING
       RETURNING *`,
      [tenant.id, 'VENDOR-001', 'Test Vendor Inc.', 'active']
    );

    if (vendorResult.rows.length > 0) {
      console.log('Created vendor:', vendorResult.rows[0].name);
    }

    console.log('Database seeding completed!');
    console.log('\nTest credentials:');
    console.log('Email: admin@test.com');
    console.log('Password: admin123');
    console.log('Tenant ID:', tenant.id);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
