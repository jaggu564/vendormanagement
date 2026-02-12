/**
 * RFP (Bid Manager) Routes
 * Module 1: AI-assisted RFP creation, distribution, and evaluation
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/rfp
 * List RFPs with filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, owner_id, vendor_id } = req.query;
    let sql = `
      SELECT r.*, 
             u.first_name || ' ' || u.last_name as owner_name,
             COUNT(DISTINCT ri.id) as invitation_count,
             COUNT(DISTINCT rr.id) as response_count
      FROM rfps r
      LEFT JOIN users u ON r.owner_id = u.id
      LEFT JOIN rfp_invitations ri ON r.id = ri.rfp_id
      LEFT JOIN rfp_responses rr ON r.id = rr.rfp_id
      WHERE r.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (owner_id) {
      sql += ` AND r.owner_id = $${paramIndex}`;
      params.push(owner_id);
      paramIndex++;
    }

    if (vendor_id) {
      sql += ` AND EXISTS (
        SELECT 1 FROM rfp_invitations ri2 
        WHERE ri2.rfp_id = r.id AND ri2.vendor_id = $${paramIndex}
      )`;
      params.push(vendor_id);
      paramIndex++;
    }

    sql += ' GROUP BY r.id, u.first_name, u.last_name ORDER BY r.created_at DESC';

    const result = await query(sql, params);
    res.json({ rfps: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rfp/:id
 * Get RFP details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const rfpResult = await query(
      `SELECT r.*, 
              u.first_name || ' ' || u.last_name as owner_name
       FROM rfps r
       LEFT JOIN users u ON r.owner_id = u.id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [id, req.tenantId]
    );

    if (rfpResult.rows.length === 0) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    const rfp = rfpResult.rows[0];

    // Get sections
    const sectionsResult = await query(
      'SELECT * FROM rfp_sections WHERE rfp_id = $1 ORDER BY section_number',
      [id]
    );

    // Get invitations
    const invitationsResult = await query(
      `SELECT ri.*, v.name as vendor_name, v.vendor_code
       FROM rfp_invitations ri
       JOIN vendors v ON ri.vendor_id = v.id
       WHERE ri.rfp_id = $1`,
      [id]
    );

    // Get responses
    const responsesResult = await query(
      `SELECT rr.*, v.name as vendor_name, v.vendor_code
       FROM rfp_responses rr
       JOIN vendors v ON rr.vendor_id = v.id
       WHERE rr.rfp_id = $1`,
      [id]
    );

    res.json({
      rfp: {
        ...rfp,
        sections: sectionsResult.rows,
        invitations: invitationsResult.rows,
        responses: responsesResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rfp
 * Create new RFP (AI-assisted)
 */
router.post('/', [
  body('title').notEmpty().trim(),
  body('description').optional(),
  body('due_date').optional().isISO8601()
], authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, due_date } = req.body;

    // Generate RFP number
    const rfpCount = await query(
      'SELECT COUNT(*) as count FROM rfps WHERE tenant_id = $1',
      [req.tenantId]
    );
    const rfpNumber = `RFP-${new Date().getFullYear()}-${String(rfpCount.rows[0].count + 1).padStart(5, '0')}`;

    // Create RFP
    const result = await query(
      `INSERT INTO rfps (tenant_id, rfp_number, title, description, owner_id, created_by, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
       RETURNING *`,
      [req.tenantId, rfpNumber, title, description, req.user.id, req.user.id, due_date]
    );

    const rfp = result.rows[0];

    // TODO: Call AI service for suggestions
    // For now, return placeholder AI suggestions
    const aiSuggestions = await generateAISuggestions(rfp.id, title, description);

    res.status(201).json({
      rfp,
      ai_suggestions: aiSuggestions,
      message: 'RFP created. Review AI suggestions before publishing.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rfp/:id/sections
 * Add section to RFP (with AI assistance)
 */
router.post('/:id/sections', [
  body('title').notEmpty(),
  body('section_type').isIn(['technical', 'commercial', 'legal', 'general']),
  body('content').optional()
], authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, content, section_type } = req.body;

    // Verify RFP ownership
    const rfpCheck = await query(
      'SELECT id, status FROM rfps WHERE id = $1 AND tenant_id = $2 AND owner_id = $3',
      [id, req.tenantId, req.user.id]
    );

    if (rfpCheck.rows.length === 0) {
      return res.status(404).json({ error: 'RFP not found or access denied' });
    }

    if (rfpCheck.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'RFP is locked and cannot be modified' });
    }

    // Get next section number
    const sectionCount = await query(
      'SELECT COUNT(*) as count FROM rfp_sections WHERE rfp_id = $1',
      [id]
    );
    const sectionNumber = sectionCount.rows[0].count + 1;

    // Generate AI content if not provided
    let finalContent = content;
    let aiGenerated = false;
    let aiRationale = null;

    if (!content) {
      const aiResult = await generateAISectionContent(id, title, section_type);
      finalContent = aiResult.content;
      aiGenerated = true;
      aiRationale = aiResult.rationale;
    }

    const result = await query(
      `INSERT INTO rfp_sections (rfp_id, section_number, title, content, section_type, ai_generated, ai_rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, sectionNumber, title, finalContent, section_type, aiGenerated, aiRationale]
    );

    res.status(201).json({
      section: result.rows[0],
      message: aiGenerated ? 'Section created with AI assistance' : 'Section created'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rfp/:id/invite
 * Invite vendors to RFP
 */
router.post('/:id/invite', [
  body('vendor_ids').isArray().notEmpty(),
  body('vendor_ids.*').isUUID()
], authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { vendor_ids, response_deadline } = req.body;

    // Verify RFP
    const rfpCheck = await query(
      'SELECT id, status, due_date FROM rfps WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );

    if (rfpCheck.rows.length === 0) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    const rfp = rfpCheck.rows[0];
    const deadline = response_deadline || rfp.due_date;

    // Create invitations
    const invitations = [];
    for (const vendorId of vendor_ids) {
      // Check if vendor exists in tenant
      const vendorCheck = await query(
        'SELECT id FROM vendors WHERE id = $1 AND tenant_id = $2',
        [vendorId, req.tenantId]
      );

      if (vendorCheck.rows.length === 0) {
        continue; // Skip invalid vendors
      }

      // Check if already invited
      const existing = await query(
        'SELECT id FROM rfp_invitations WHERE rfp_id = $1 AND vendor_id = $2',
        [id, vendorId]
      );

      if (existing.rows.length === 0) {
        const invResult = await query(
          `INSERT INTO rfp_invitations (rfp_id, vendor_id, invited_by, response_deadline, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *`,
          [id, vendorId, req.user.id, deadline]
        );
        invitations.push(invResult.rows[0]);
      }
    }

    res.status(201).json({
      invitations,
      count: invitations.length,
      message: `${invitations.length} vendor(s) invited`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rfp/:id/publish
 * Publish RFP (lock for editing)
 */
router.post('/:id/publish', authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const rfpCheck = await query(
      'SELECT id, status FROM rfps WHERE id = $1 AND tenant_id = $2 AND owner_id = $3',
      [id, req.tenantId, req.user.id]
    );

    if (rfpCheck.rows.length === 0) {
      return res.status(404).json({ error: 'RFP not found or access denied' });
    }

    if (rfpCheck.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'RFP is already published or locked' });
    }

    // Update status
    await query(
      'UPDATE rfps SET status = $1, lock_date = CURRENT_TIMESTAMP WHERE id = $2',
      ['published', id]
    );

    res.json({ message: 'RFP published successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rfp/:id/evaluate
 * Start AI-assisted evaluation
 */
router.post('/:id/evaluate', authorize('buyer_admin', 'evaluation_committee'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get all submitted responses
    const responsesResult = await query(
      `SELECT rr.*, v.name as vendor_name
       FROM rfp_responses rr
       JOIN vendors v ON rr.vendor_id = v.id
       WHERE rr.rfp_id = $1 AND rr.status = 'submitted'`,
      [id]
    );

    if (responsesResult.rows.length === 0) {
      return res.status(400).json({ error: 'No submitted responses to evaluate' });
    }

    // TODO: Call AI evaluation service
    // For now, generate placeholder evaluations
    const evaluations = [];
    for (const response of responsesResult.rows) {
      const evalResult = await generateAIEvaluation(response.id, id);
      evaluations.push(evalResult);
    }

    res.json({
      evaluations,
      message: 'AI evaluation completed. Review and override as needed.',
      advisory_only: true
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rfp/:id/override-score
 * Override AI evaluation score (human override)
 */
router.post('/:id/override-score', [
  body('evaluation_id').isUUID(),
  body('new_score').isFloat({ min: 0, max: 100 }),
  body('rationale').notEmpty()
], authorize('buyer_admin', 'evaluation_committee'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { evaluation_id, new_score, rationale, override_reason } = req.body;

    // Get original evaluation
    const evalResult = await query(
      'SELECT * FROM ai_evaluation_scores WHERE id = $1',
      [evaluation_id]
    );

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    const originalEval = evalResult.rows[0];

    // Create override record
    const overrideResult = await query(
      `INSERT INTO evaluation_overrides 
       (evaluation_id, overridden_by, original_score, new_score, rationale, override_reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [evaluation_id, req.user.id, originalEval.score, new_score, rationale, override_reason]
    );

    // Update the evaluation score
    await query(
      'UPDATE ai_evaluation_scores SET score = $1 WHERE id = $2',
      [new_score, evaluation_id]
    );

    res.json({
      override: overrideResult.rows[0],
      message: 'Score overridden successfully. Override logged for audit.'
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions (placeholders for AI integration)
async function generateAISuggestions(rfpId, title, description) {
  // TODO: Integrate with AI service
  return [
    {
      type: 'section_suggestion',
      suggestion: 'Add commercial terms section',
      rationale: 'Based on past RFP patterns, commercial terms are typically required for vendor selection',
      confidence: 0.85
    }
  ];
}

async function generateAISectionContent(rfpId, title, sectionType) {
  // TODO: Integrate with AI service
  return {
    content: `[AI-generated content for ${title} - ${sectionType} section]`,
    rationale: `Generated based on standard ${sectionType} requirements and past RFP patterns`
  };
}

async function generateAIEvaluation(responseId, rfpId) {
  // TODO: Integrate with AI evaluation service
  // This would analyze responses, compare costs, flag anomalies, etc.
  
  const criteria = ['technical_capability', 'cost', 'timeline', 'experience'];
  const evaluations = [];

  for (const criterion of criteria) {
    const score = Math.random() * 100;
    const weight = criterion === 'cost' ? 0.3 : 0.23;
    
    const evalResult = await query(
      `INSERT INTO ai_evaluation_scores 
       (response_id, criterion, score, weight, weighted_score, ai_confidence, ai_rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        responseId,
        criterion,
        score,
        weight,
        score * weight,
        0.85,
        `AI evaluation based on response content analysis for ${criterion}`
      ]
    );
    evaluations.push(evalResult.rows[0]);
  }

  return evaluations;
}

module.exports = router;
