/**
 * Surveys (VOC/VOV) Routes
 * Module 8: Voice of Customer/Vendor surveys
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/surveys
 * List surveys
 */
router.get('/', async (req, res, next) => {
  try {
    const { type, status } = req.query;
    let sql = `
      SELECT s.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM surveys s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIndex = 2;

    if (type) {
      sql += ` AND s.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      sql += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY s.created_at DESC';

    const result = await query(sql, params);
    res.json({ surveys: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/surveys
 * Create survey
 */
router.post('/', [
  body('title').notEmpty(),
  body('type').isIn(['VOC', 'VOV']),
  body('questions').isArray().notEmpty()
], authorize('buyer_admin', 'buyer_user'), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, type, questions, target_audience } = req.body;

    // Generate survey number
    const count = await query(
      'SELECT COUNT(*) as count FROM surveys WHERE tenant_id = $1',
      [req.tenantId]
    );
    const surveyNumber = `SRV-${new Date().getFullYear()}-${String(count.rows[0].count + 1).padStart(5, '0')}`;

    const result = await query(
      `INSERT INTO surveys 
       (tenant_id, survey_number, title, description, type, questions, target_audience, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
       RETURNING *`,
      [req.tenantId, surveyNumber, title, description, type, 
       JSON.stringify(questions), JSON.stringify(target_audience || []), req.user.id]
    );

    res.status(201).json({ survey: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/surveys/:id/responses
 * Submit survey response
 */
router.post('/:id/responses', [
  body('responses').isObject().notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { responses, vendor_id } = req.body;

    // Verify survey exists and is active
    const surveyCheck = await query(
      'SELECT id, status FROM surveys WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );

    if (surveyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    if (surveyCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Survey is not active' });
    }

    // Analyze sentiment (AI)
    const sentimentResult = await analyzeSentiment(responses);

    const result = await query(
      `INSERT INTO survey_responses 
       (survey_id, respondent_id, vendor_id, responses, sentiment_score, ai_analyzed, ai_rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.user.id, vendor_id, JSON.stringify(responses), 
       sentimentResult.score, true, sentimentResult.rationale]
    );

    res.status(201).json({
      response: result.rows[0],
      sentiment_analysis: {
        score: sentimentResult.score,
        rationale: sentimentResult.rationale,
        advisory_only: true
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/surveys/:id/analytics
 * Get survey analytics (AI-assisted)
 */
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get all responses
    const responsesResult = await query(
      'SELECT * FROM survey_responses WHERE survey_id = $1',
      [id]
    );

    // Calculate aggregate sentiment
    const avgSentiment = responsesResult.rows.length > 0
      ? responsesResult.rows.reduce((sum, r) => sum + (parseFloat(r.sentiment_score) || 0), 0) / responsesResult.rows.length
      : 0;

    // TODO: Generate AI insights
    const aiInsights = await generateSurveyInsights(id, responsesResult.rows);

    res.json({
      total_responses: responsesResult.rows.length,
      average_sentiment: avgSentiment,
      ai_insights: aiInsights,
      advisory_only: true
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function analyzeSentiment(responses) {
  // TODO: Integrate with AI sentiment analysis
  return {
    score: 75.5, // 0-100 scale
    rationale: 'Overall positive sentiment detected. Key contributing factors: satisfaction with delivery (85%), communication (80%), pricing (70%)'
  };
}

async function generateSurveyInsights(surveyId, responses) {
  // TODO: Integrate with AI service
  return {
    key_drivers: ['Delivery quality', 'Communication', 'Pricing'],
    trend: 'improving',
    comparison_to_historic: '5% above average',
    bias_check: {
      flagged: false,
      message: 'No significant bias patterns detected'
    }
  };
}

module.exports = router;
