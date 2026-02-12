/**
 * Authentication Routes
 * Supports JWT and SSO (SAML 2.0, OAuth2)
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/v1/auth/login
 * Standard email/password login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email and tenant
    const userQuery = `
  SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.status as tenant_status
  FROM users u
  JOIN tenants t ON u.tenant_id = t.id
  WHERE u.email = $1
`;

const queryParams = [email];

    const userResult = await query(userQuery, queryParams);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = userResult.rows[0];

    // Check tenant status
    if (user.tenant_status !== 'active') {
      return res.status(403).json({
        error: 'Tenant is not active',
        code: 'TENANT_INACTIVE'
      });
    }

    // Check user status
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'User account is not active',
        code: 'USER_INACTIVE'
      });
    }

    // Verify password
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'Password not set. Please use SSO login.',
        code: 'SSO_REQUIRED'
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/register
 * User registration (typically for vendor users)
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('first_name').notEmpty(),
  body('last_name').notEmpty(),
  body('tenant_id').isUUID(),
  body('role').isIn(['vendor_user'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, first_name, last_name, tenant_id, role } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
      [email, tenant_id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [tenant_id, email, password_hash, first_name, last_name, role]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id,
              t.name as tenant_name, t.data_region
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    const token = jwt.sign(
      {
        userId: req.user.id,
        email: req.user.email,
        tenantId: req.user.tenant_id,
        role: req.user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
