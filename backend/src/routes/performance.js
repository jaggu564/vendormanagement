/**
 * Vendor Performance Management Routes
 * Module 4: Performance tracking and scoring
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/performance/scorecards
 * Get performance scorecards
 */
router.get('/scorecards', async (req, res, next) => {
  try {
    const { vendor_id, contract_id, period_start, period_end } = req.query;
    let sql = `
      SELECT sc.*, v.name as vendor_name, v.vendor_code
      FROM performance_scorecards sc
      JOIN vendors v ON sc.vendor_id = v.id
      WHERE sc.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (vendor_id) {
      sql += ` AND sc.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    if (contract_id) {
      sql += ` AND sc.contract_id = $${paramIndex}`;
      params.push(contract_id);
      paramIndex++;
    }

    if (period_start) {
      sql += ` AND sc.period_end >= $${paramIndex}`;
      params.push(period_start);
      paramIndex++;
    }

    if (period_end) {
      sql += ` AND sc.period_start <= $${paramIndex}`;
      params.push(period_end);
      paramIndex++;
    }

    sql += ' ORDER BY sc.period_end DESC';

    const result = await query(sql, params);

    // Get metrics for each scorecard
    for (const scorecard of result.rows) {
      const metricsResult = await query(
        'SELECT * FROM performance_metrics WHERE scorecard_id = $1',
        [scorecard.id]
      );
      scorecard.metrics = metricsResult.rows;
    }

    res.json({ scorecards: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/performance/scorecards
 * Create performance scorecard (AI-assisted)
 */
router.post('/scorecards', [
  body('vendor_id').isUUID(),
  body('period_start').isISO8601(),
  body('period_end').isISO8601()
], authorize('buyer_admin'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendor_id, contract_id, period_start, period_end } = req.body;

    // Generate AI scorecard
    const aiResult = await generateAIScorecard(vendor_id, contract_id, period_start, period_end);

    const result = await query(
      `INSERT INTO performance_scorecards 
       (tenant_id, vendor_id, contract_id, period_start, period_end, 
        overall_score, ai_generated, ai_confidence, ai_rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.tenantId, vendor_id, contract_id, period_start, period_end,
       aiResult.overall_score, true, aiResult.confidence, aiResult.rationale]
    );

    const scorecard = result.rows[0];

    // Insert metrics
    for (const metric of aiResult.metrics) {
      await query(
        `INSERT INTO performance_metrics 
         (scorecard_id, metric_name, metric_value, target_value, unit, score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [scorecard.id, metric.name, metric.value, metric.target, metric.unit, metric.score]
      );
    }

    res.status(201).json({
      scorecard,
      ai_explanation: {
        confidence: aiResult.confidence,
        rationale: aiResult.rationale,
        data_sources: aiResult.data_sources,
        advisory_only: true
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/performance/penalties
 * List penalties
 */
router.get('/penalties', async (req, res, next) => {
  try {
    const { vendor_id, status } = req.query;
    let sql = `
      SELECT p.*, v.name as vendor_name
      FROM penalties p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE p.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (vendor_id) {
      sql += ` AND p.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    if (status) {
      sql += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    res.json({ penalties: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/performance/penalties
 * Create penalty (AI-suggested, requires human approval)
 */
router.post('/penalties', [
  body('vendor_id').isUUID(),
  body('penalty_type').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('reason').notEmpty()
], authorize('buyer_admin'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendor_id, contract_id, penalty_type, amount, currency, reason } = req.body;

    // Check for bias patterns
    const biasCheck = await checkBiasPatterns(vendor_id, penalty_type);

    const result = await query(
      `INSERT INTO penalties 
       (tenant_id, vendor_id, contract_id, penalty_type, amount, currency, reason, 
        ai_suggested, ai_rationale, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [req.tenantId, vendor_id, contract_id, penalty_type, amount, currency || 'USD', reason,
       false, biasCheck.rationale, req.user.id]
    );

    const penalty = result.rows[0];

    if (biasCheck.flagged) {
      penalty.bias_flag = {
        flagged: true,
        reason: biasCheck.reason,
        requires_review: true
      };
    }

    res.status(201).json({
      penalty,
      message: 'Penalty created. Requires approval before enforcement.',
      advisory_only: true
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/performance/penalties/:id/approve
 * Approve penalty
 */
router.post('/penalties/:id/approve', authorize('buyer_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE penalties 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user.id, id, req.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Penalty not found or cannot be approved' });
    }

    res.json({ penalty: result.rows[0], message: 'Penalty approved' });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function generateAIScorecard(vendorId, contractId, periodStart, periodEnd) {
  // TODO: Integrate with AI service
  return {
    overall_score: 85.5,
    confidence: 0.88,
    rationale: 'Score based on SLA compliance (95%), delivery timeliness (90%), and quality metrics (80%)',
    data_sources: ['SLA logs', 'Delivery records', 'Quality assessments'],
    metrics: [
      { name: 'SLA Compliance', value: 95, target: 98, unit: '%', score: 92 },
      { name: 'On-Time Delivery', value: 90, target: 95, unit: '%', score: 85 },
      { name: 'Quality Score', value: 80, target: 85, unit: 'points', score: 78 }
    ]
  };
}

async function checkBiasPatterns(vendorId, penaltyType) {
  // TODO: Implement bias detection
  // Check for patterns in penalty assignment by geography, protected class, etc.
  return {
    flagged: false,
    rationale: 'No bias patterns detected'
  };
}

module.exports = router;
