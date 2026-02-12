/**
 * Integration Routes
 * Integration framework for external systems
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/integrations
 * List integrations
 */
router.get('/', authorize('buyer_admin'), async (req, res, next) => {
  try {
    const { type, status } = req.query;
    let sql = 'SELECT * FROM integrations WHERE tenant_id = $1';
    const params = [req.tenantId];
    let paramIndex = 2;

    if (type) {
      sql += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ integrations: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/integrations
 * Create integration (requires approval)
 */
router.post('/', [
  body('name').notEmpty(),
  body('type').isIn(['ERP', 'RiskProvider', 'Signature', 'DocumentRepo']),
  body('system').notEmpty(),
  body('configuration').isObject()
], authorize('buyer_admin'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, type, system, configuration, field_mappings } = req.body;

    const result = await query(
      `INSERT INTO integrations 
       (tenant_id, name, type, system, configuration, field_mappings, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'testing')
       RETURNING *`,
      [req.tenantId, name, type, system, JSON.stringify(configuration), 
       JSON.stringify(field_mappings || {}), req.user.id]
    );

    res.status(201).json({
      integration: result.rows[0],
      message: 'Integration created. Requires approval before activation.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/integrations/:id/sync-logs
 * Get integration sync logs
 */
router.get('/:id/sync-logs', authorize('buyer_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const result = await query(
      `SELECT * FROM integration_sync_logs 
       WHERE integration_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [id, limit]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
