/**
 * Helpdesk & Dispute Management Routes
 * Module 7: Ticket management system
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/helpdesk/tickets
 * List tickets
 */
router.get('/tickets', async (req, res, next) => {
  try {
    const { status, type, priority, vendor_id } = req.query;
    let sql = `
      SELECT t.*, 
             u1.first_name || ' ' || u1.last_name as created_by_name,
             u2.first_name || ' ' || u2.last_name as assigned_to_name,
             v.name as vendor_name
      FROM tickets t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN vendors v ON t.vendor_id = v.id
      WHERE t.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      sql += ` AND t.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (priority) {
      sql += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (vendor_id) {
      sql += ` AND t.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    sql += ' ORDER BY t.created_at DESC';

    const result = await query(sql, params);
    res.json({ tickets: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/helpdesk/tickets
 * Create ticket
 */
router.post('/tickets', [
  body('title').notEmpty(),
  body('description').notEmpty(),
  body('type').isIn(['dispute', 'support', 'question', 'complaint']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, type, priority, vendor_id, contract_id, attachments } = req.body;

    // Generate ticket number
    const count = await query(
      'SELECT COUNT(*) as count FROM tickets WHERE tenant_id = $1',
      [req.tenantId]
    );
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(count.rows[0].count + 1).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO tickets 
       (tenant_id, ticket_number, title, description, type, priority, 
        created_by, vendor_id, contract_id, attachments, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
       RETURNING *`,
      [req.tenantId, ticketNumber, title, description, type, priority || 'medium',
       req.user.id, vendor_id, contract_id, JSON.stringify(attachments || [])]
    );

    res.status(201).json({ ticket: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/helpdesk/tickets/:id
 * Get ticket with comments
 */
router.get('/tickets/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const ticketResult = await query(
      `SELECT t.*, 
              u1.first_name || ' ' || u1.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as assigned_to_name
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by = u1.id
       LEFT JOIN users u2 ON t.assigned_to = u2.id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, req.tenantId]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    // Get comments
    const commentsResult = await query(
      `SELECT tc.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM ticket_comments tc
       LEFT JOIN users u ON tc.created_by = u.id
       WHERE tc.ticket_id = $1
       ORDER BY tc.created_at ASC`,
      [id]
    );

    res.json({
      ticket: {
        ...ticket,
        comments: commentsResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/helpdesk/tickets/:id/comments
 * Add comment to ticket
 */
router.post('/tickets/:id/comments', [
  body('comment').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { comment, attachments } = req.body;

    // Verify ticket exists
    const ticketCheck = await query(
      'SELECT id FROM tickets WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const result = await query(
      `INSERT INTO ticket_comments (ticket_id, comment, created_by, attachments)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, comment, req.user.id, JSON.stringify(attachments || [])]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
