/**
 * Contract/MSA & SOW Routes
 * Module 2: AI-assisted contract generation
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/contracts
 * List contracts
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, vendor_id, contract_type } = req.query;
    let sql = `
      SELECT c.*, v.name as vendor_name, v.vendor_code
      FROM contracts c
      JOIN vendors v ON c.vendor_id = v.id
      WHERE c.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (vendor_id) {
      sql += ` AND c.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    if (contract_type) {
      sql += ` AND c.contract_type = $${paramIndex}`;
      params.push(contract_type);
      paramIndex++;
    }

    sql += ' ORDER BY c.created_at DESC';

    const result = await query(sql, params);
    res.json({ contracts: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/contracts
 * Create contract (AI-assisted)
 */
router.post('/', [
  body('vendor_id').isUUID(),
  body('contract_type').isIn(['MSA', 'SOW', 'PO', 'Amendment']),
  body('content').optional(),
  body('template_version').optional()
], authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendor_id, contract_type, content, template_version, rfp_id, effective_date, expiration_date } = req.body;

    // Generate contract number
    const count = await query(
      'SELECT COUNT(*) as count FROM contracts WHERE tenant_id = $1',
      [req.tenantId]
    );
    const contractNumber = `${contract_type}-${new Date().getFullYear()}-${String(count.rows[0].count + 1).padStart(5, '0')}`;

    // Generate AI content if not provided
    let finalContent = content;
    let aiGenerated = false;
    let aiRationale = null;

    if (!content) {
      const aiResult = await generateAIContract(vendor_id, contract_type, template_version);
      finalContent = aiResult.content;
      aiGenerated = true;
      aiRationale = aiResult.rationale;
    }

    const result = await query(
      `INSERT INTO contracts 
       (tenant_id, contract_number, rfp_id, vendor_id, contract_type, content, 
        template_version, ai_generated, ai_rationale, effective_date, expiration_date, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
       RETURNING *`,
      [req.tenantId, contractNumber, rfp_id, vendor_id, contract_type, finalContent,
       template_version, aiGenerated, aiRationale, effective_date, expiration_date, req.user.id]
    );

    const contract = result.rows[0];

    // Extract and store clauses
    if (finalContent) {
      await extractClauses(contract.id, finalContent, aiGenerated, aiRationale);
    }

    res.status(201).json({
      contract,
      ai_generated: aiGenerated,
      message: aiGenerated ? 'Contract draft created with AI assistance' : 'Contract created'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/contracts/:id
 * Get contract with clauses and versions
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const contractResult = await query(
      `SELECT c.*, v.name as vendor_name, v.vendor_code
       FROM contracts c
       JOIN vendors v ON c.vendor_id = v.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, req.tenantId]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = contractResult.rows[0];

    // Get clauses
    const clausesResult = await query(
      'SELECT * FROM contract_clauses WHERE contract_id = $1 ORDER BY clause_number',
      [id]
    );

    // Get versions
    const versionsResult = await query(
      `SELECT cv.*, u.first_name || ' ' || u.last_name as changed_by_name
       FROM contract_versions cv
       LEFT JOIN users u ON cv.changed_by = u.id
       WHERE cv.contract_id = $1
       ORDER BY cv.version_number DESC`,
      [id]
    );

    res.json({
      contract: {
        ...contract,
        clauses: clausesResult.rows,
        versions: versionsResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/contracts/:id/lock
 * Lock contract (buyer admin only)
 */
router.post('/:id/lock', authorize('buyer_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE contracts 
       SET status = 'locked', locked_by = $1, locked_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3 AND status = 'in_review'
       RETURNING *`,
      [req.user.id, id, req.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found or cannot be locked' });
    }

    // Create version snapshot
    await query(
      `INSERT INTO contract_versions (contract_id, version_number, content, changed_by, change_summary)
       SELECT id, 
              COALESCE((SELECT MAX(version_number) FROM contract_versions WHERE contract_id = $1), 0) + 1,
              content, $2, 'Contract locked'
       FROM contracts WHERE id = $1`,
      [id, req.user.id]
    );

    res.json({ contract: result.rows[0], message: 'Contract locked successfully' });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function generateAIContract(vendorId, contractType, templateVersion) {
  // TODO: Integrate with AI service
  return {
    content: `[AI-generated ${contractType} content based on template ${templateVersion || 'default'}]`,
    rationale: `Generated based on preferred ${contractType} template, version ${templateVersion || 'V2.5'}`
  };
}

async function extractClauses(contractId, content, aiGenerated, aiRationale) {
  // TODO: Extract clauses from content
  // For now, create a placeholder clause
  await query(
    `INSERT INTO contract_clauses 
     (contract_id, clause_number, title, content, clause_type, source, ai_generated, ai_rationale)
     VALUES ($1, '1', 'General Terms', $2, 'standard', 'template', $3, $4)`,
    [contractId, content.substring(0, 500), aiGenerated, aiRationale]
  );
}

module.exports = router;
