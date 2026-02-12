# Vendor Management Platform - Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up database:**
   - Create PostgreSQL database: `createdb vendor_management`
   - Copy `.env.example` to `.env` and configure

3. **Run migrations:**
   ```bash
   npm run migrate
   ```

4. **Seed test data:**
   ```bash
   npm run seed
   ```

5. **Start server:**
   ```bash
   npm run dev
   ```

## Test Credentials

After seeding:
- Email: `admin@test.com`
- Password: `admin123`
- Tenant ID: (shown in seed output)

## API Documentation

All endpoints are prefixed with `/api/v1`

### Authentication
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user

### Modules
- `/rfp` - Bid Manager
- `/contracts` - Contract Management
- `/procurement` - Procurement & Onboarding
- `/performance` - Performance Management
- `/risk` - Risk Management
- `/analytics` - Analytics
- `/helpdesk` - Helpdesk
- `/surveys` - Surveys
- `/admin` - Administration

## Architecture

- **Multi-tenancy**: All data is tenant-scoped
- **RBAC**: Role-based access control enforced
- **Audit Logging**: All actions are logged
- **AI Integration**: Structured for AI explainability
