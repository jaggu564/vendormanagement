/**
 * Procurement & Onboarding Routes
 * Module 3: ERP integration and vendor onboarding
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/procurement/purchase-orders
 * List purchase orders
 */
router.get('/purchase-orders', async (req, res, next) => {
  try {
    const { status, vendor_id } = req.query;
    let sql = `
      SELECT po.*, v.name as vendor_name, v.vendor_code
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND po.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (vendor_id) {
      sql += ` AND po.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    sql += ' ORDER BY po.created_at DESC';

    const result = await query(sql, params);
    res.json({ purchase_orders: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/procurement/purchase-orders
 * Create purchase order
 */
router.post('/purchase-orders', [
  body('vendor_id').isUUID(),
  body('total_amount').isFloat({ min: 0 }),
  body('line_items').isArray().notEmpty(),
  body('currency').optional().default('USD')
], authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendor_id, contract_id, total_amount, currency, line_items, erp_system } = req.body;

    // Generate PO number
    const count = await query(
      'SELECT COUNT(*) as count FROM purchase_orders WHERE tenant_id = $1',
      [req.tenantId]
    );
    const poNumber = `PO-${new Date().getFullYear()}-${String(count.rows[0].count + 1).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO purchase_orders 
       (tenant_id, po_number, contract_id, vendor_id, total_amount, currency, line_items, erp_system, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
       RETURNING *`,
      [req.tenantId, poNumber, contract_id, vendor_id, total_amount, currency, JSON.stringify(line_items), erp_system, req.user.id]
    );

    const po = result.rows[0];

    // Sync to ERP if configured
    if (erp_system) {
      try {
        await syncPOToERP(po.id, erp_system);
      } catch (erpError) {
        // Log error but don't fail the request
        console.error('ERP sync error:', erpError);
        await query(
          'UPDATE purchase_orders SET erp_sync_status = $1, erp_sync_error = $2 WHERE id = $3',
          ['failed', erpError.message, po.id]
        );
      }
    }

    res.status(201).json({ purchase_order: po });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/procurement/purchase-orders/:id/sync
 * Manually sync PO to ERP
 */
router.post('/purchase-orders/:id/sync', authorize('buyer_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const poResult = await query(
      'SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );

    if (poResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const po = poResult.rows[0];

    if (!po.erp_system) {
      return res.status(400).json({ error: 'No ERP system configured for this PO' });
    }

    try {
      await syncPOToERP(id, po.erp_system);
      res.json({ message: 'PO synced to ERP successfully' });
    } catch (error) {
      res.status(503).json({
        error: 'ERP sync failed',
        message: error.message,
        retryable: true
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/procurement/onboarding
 * List vendor onboarding records
 */
router.get('/onboarding', async (req, res, next) => {
  try {
    const { status, vendor_id } = req.query;
    let sql = `
      SELECT o.*, v.name as vendor_name, v.vendor_code
      FROM vendor_onboarding o
      JOIN vendors v ON o.vendor_id = v.id
      WHERE o.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (vendor_id) {
      sql += ` AND o.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    sql += ' ORDER BY o.created_at DESC';

    const result = await query(sql, params);
    res.json({ onboarding: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/procurement/onboarding
 * Initiate vendor onboarding
 */
router.post('/onboarding', [
  body('vendor_id').isUUID()
], authorize('buyer_admin'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendor_id, onboarding_steps } = req.body;

    // Check if onboarding already exists
    const existing = await query(
      'SELECT id FROM vendor_onboarding WHERE vendor_id = $1 AND tenant_id = $2 AND status != $3',
      [vendor_id, req.tenantId, 'completed']
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Onboarding already in progress' });
    }

    const defaultSteps = onboarding_steps || [
      { step: 'vendor_info', status: 'pending' },
      { step: 'tax_documents', status: 'pending' },
      { step: 'bank_details', status: 'pending' },
      { step: 'contract_signing', status: 'pending' }
    ];

    const result = await query(
      `INSERT INTO vendor_onboarding 
       (tenant_id, vendor_id, onboarding_steps, initiated_by, status)
       VALUES ($1, $2, $3, $4, 'initiated')
       RETURNING *`,
      [req.tenantId, vendor_id, JSON.stringify(defaultSteps), req.user.id]
    );

    res.status(201).json({ onboarding: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Helper function for ERP sync
async function syncPOToERP(poId, erpSystem) {
  // TODO: Implement actual ERP integration
  // This would call SAP, Oracle, NetSuite APIs based on erpSystem
  
  // Simulate sync
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Update sync status
  const erpPoId = `ERP-${poId.substring(0, 8)}`;
  await query(
    'UPDATE purchase_orders SET erp_sync_status = $1, erp_po_id = $2 WHERE id = $3',
    ['synced', erpPoId, poId]
  );

  // Log sync
  await query(
    `INSERT INTO integration_sync_logs 
     (integration_id, sync_type, direction, status, records_processed, completed_at)
     VALUES ($1, 'po', 'push', 'success', 1, CURRENT_TIMESTAMP)`,
    [null] // integration_id would come from integrations table
  );
}

module.exports = router;
