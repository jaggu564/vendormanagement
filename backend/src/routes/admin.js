/**
 * Admin Routes
 * Administrative functions
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.use(authorize('buyer_admin')); // All admin routes require admin role

/**
 * GET /api/v1/admin/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { user_id, action, module, start_date, end_date, limit = 100 } = req.query;
    let sql = `
      SELECT * FROM audit_logs 
      WHERE tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (user_id) {
      sql += ` AND user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (action) {
      sql += ` AND action LIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }

    if (module) {
      sql += ` AND module = $${paramIndex}`;
      params.push(module);
      paramIndex++;
    }

    if (start_date) {
      sql += ` AND timestamp >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      sql += ` AND timestamp <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    sql += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(sql, params);
    res.json({ logs: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/vendors
 * List all vendors
 */
router.get('/vendors', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM vendors WHERE tenant_id = $1';
    const params = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY name';

    const result = await query(sql, params);
    res.json({ vendors: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/vendors
 * Create vendor
 */
router.post('/vendors', [
  body('name').notEmpty(),
  body('vendor_code').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, vendor_code, legal_name, tax_id, contact_email, contact_phone, address } = req.body;

    const result = await query(
      `INSERT INTO vendors 
       (tenant_id, vendor_code, name, legal_name, tax_id, contact_email, contact_phone, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.tenantId, vendor_code, name, legal_name, tax_id, contact_email, contact_phone, JSON.stringify(address || {})]
    );

    res.status(201).json({ vendor: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
