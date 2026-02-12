/**
 * Vendor Risk Management Routes
 * Module 5: Risk monitoring with external integrations
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/risk/assessments
 * Get risk assessments
 */
router.get('/assessments', async (req, res, next) => {
  try {
    const { vendor_id } = req.query;
    let sql = `
      SELECT ra.*, v.name as vendor_name, v.vendor_code
      FROM vendor_risk_assessments ra
      JOIN vendors v ON ra.vendor_id = v.id
      WHERE ra.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (vendor_id) {
      sql += ` AND ra.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    sql += ' ORDER BY ra.assessment_date DESC';

    const result = await query(sql, params);
    res.json({ assessments: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/risk/assessments
 * Create risk assessment (from external provider)
 */
router.post('/assessments', [
  body('vendor_id').isUUID(),
  body('provider').isIn(['Moodys', 'DnB', 'SP', 'internal'])
], authorize('buyer_admin'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vendor_id, provider } = req.body;

    // Fetch risk data from external provider
    let riskData;
    try {
      riskData = await fetchRiskData(vendor_id, provider);
    } catch (error) {
      return res.status(503).json({
        error: 'Risk provider unavailable',
        message: error.message,
        retryable: true
      });
    }

    // Determine risk level
    const riskLevel = calculateRiskLevel(riskData.risk_score);

    const result = await query(
      `INSERT INTO vendor_risk_assessments 
       (tenant_id, vendor_id, risk_score, risk_level, assessment_date, provider, provider_data)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6)
       RETURNING *`,
      [req.tenantId, vendor_id, riskData.risk_score, riskLevel, provider, JSON.stringify(riskData)]
    );

    const assessment = result.rows[0];

    // Update consolidated vendor master (limited fields only)
    await updateVendorMaster(vendor_id, riskData.risk_score, riskLevel);

    // Check for threshold crossings and create alerts
    await checkRiskThresholds(vendor_id, riskData.risk_score, riskLevel);

    res.status(201).json({ assessment });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/risk/alerts
 * Get risk alerts
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { vendor_id, severity, status } = req.query;
    let sql = `
      SELECT ra.*, v.name as vendor_name
      FROM risk_alerts ra
      JOIN vendors v ON ra.vendor_id = v.id
      WHERE ra.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (vendor_id) {
      sql += ` AND ra.vendor_id = $${paramIndex}`;
      params.push(vendor_id);
      paramIndex++;
    }

    if (severity) {
      sql += ` AND ra.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (status) {
      sql += ` AND ra.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY ra.created_at DESC';

    const result = await query(sql, params);
    res.json({ alerts: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/risk/alerts/:id/acknowledge
 * Acknowledge risk alert
 */
router.post('/alerts/:id/acknowledge', authorize('buyer_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE risk_alerts 
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3 AND status = 'active'
       RETURNING *`,
      [req.user.id, id, req.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found or cannot be acknowledged' });
    }

    res.json({ alert: result.rows[0], message: 'Alert acknowledged' });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function fetchRiskData(vendorId, provider) {
  // TODO: Implement actual API calls to Moody's, D&B, S&P
  // For now, simulate with retry logic
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In real implementation:
      // const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
      // const response = await axios.get(`https://api.${provider.toLowerCase()}.com/risk/${vendorId}`, {
      //   headers: { 'Authorization': `Bearer ${apiKey}` }
      // });
      
      return {
        risk_score: Math.random() * 100,
        provider_data: {
          rating: 'A',
          last_updated: new Date().toISOString()
        }
      };
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(`Failed to fetch risk data after ${maxAttempts} attempts: ${error.message}`);
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
    }
  }
}

function calculateRiskLevel(riskScore) {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 50) return 'high';
  if (riskScore >= 25) return 'medium';
  return 'low';
}

async function updateVendorMaster(vendorId, riskScore, riskLevel) {
  // Update consolidated vendor master (cross-tenant, limited fields only)
  await query(
    `INSERT INTO vendor_master_consolidated (vendor_id, vendor_name, status, risk_score, risk_level)
     SELECT v.id, v.name, v.status, $1, $2
     FROM vendors v
     WHERE v.id = $3
     ON CONFLICT (vendor_id) 
     DO UPDATE SET risk_score = $1, risk_level = $2, last_updated = CURRENT_TIMESTAMP`,
    [riskScore, riskLevel, vendorId]
  );
}

async function checkRiskThresholds(vendorId, riskScore, riskLevel) {
  // Check if risk level crosses thresholds and create alerts
  if (riskLevel === 'critical' || riskLevel === 'high') {
    await query(
      `INSERT INTO risk_alerts 
       (tenant_id, vendor_id, alert_type, severity, message, source, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
      [
        req.tenantId,
        vendorId,
        'risk_threshold',
        riskLevel,
        `Vendor risk score is ${riskScore.toFixed(2)} (${riskLevel} risk level)`,
        'internal'
      ]
    );
  }
}

module.exports = router;
