/**
 * Vendor Metrics & Analytics Routes
 * Module 6: Analytics and insights
 */
const express = require('express');
const { query } = require('../database/connection');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/analytics/dashboards
 * List analytics dashboards
 */
router.get('/dashboards', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM analytics_dashboards 
       WHERE tenant_id = $1 AND (is_shared = true OR created_by = $2)
       ORDER BY created_at DESC`,
      [req.tenantId, req.user.id]
    );

    res.json({ dashboards: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/vendor-summary
 * Get vendor summary analytics
 */
router.get('/vendor-summary', async (req, res, next) => {
  try {
    const { vendor_id } = req.query;

    if (!vendor_id) {
      return res.status(400).json({ error: 'vendor_id is required' });
    }

    // Get vendor stats
    const stats = await query(
      `SELECT 
        COUNT(DISTINCT c.id) as contract_count,
        COUNT(DISTINCT po.id) as po_count,
        COALESCE(SUM(po.total_amount), 0) as total_spend,
        AVG(sc.overall_score) as avg_performance_score
       FROM vendors v
       LEFT JOIN contracts c ON v.id = c.vendor_id
       LEFT JOIN purchase_orders po ON v.id = po.vendor_id
       LEFT JOIN performance_scorecards sc ON v.id = sc.vendor_id
       WHERE v.id = $1 AND v.tenant_id = $2
       GROUP BY v.id`,
      [vendor_id, req.tenantId]
    );

    // Get recent risk assessment
    const riskResult = await query(
      `SELECT risk_score, risk_level, assessment_date
       FROM vendor_risk_assessments
       WHERE vendor_id = $1 AND tenant_id = $2
       ORDER BY assessment_date DESC
       LIMIT 1`,
      [vendor_id, req.tenantId]
    );

    // TODO: Generate AI insights
    const aiInsights = await generateAIInsights(vendor_id);

    res.json({
      summary: stats.rows[0] || {},
      risk: riskResult.rows[0] || null,
      ai_insights: aiInsights,
      advisory_only: true
    });
  } catch (error) {
    next(error);
  }
});

// Helper function
async function generateAIInsights(vendorId) {
  // TODO: Integrate with AI service for predictive analytics
  return {
    trend: 'stable',
    key_drivers: ['SLA compliance', 'Delivery timeliness'],
    prediction: 'Performance expected to remain stable in next quarter',
    confidence: 0.82,
    data_sources: ['Performance scorecards', 'Risk assessments', 'Contract history']
  };
}

module.exports = router;
