-- Vendor Management Platform Database Schema
-- Multi-tenant architecture with tenant isolation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table (for multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    data_region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    hosting_type VARCHAR(20) NOT NULL DEFAULT 'cloud', -- 'cloud', 'on-premise', 'private-cloud'
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL, -- 'buyer_admin', 'buyer_user', 'vendor_user', 'evaluation_committee'
    sso_id VARCHAR(255), -- For SSO integration
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

-- Roles and Permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- User Role Assignments
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended', 'pending'
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, vendor_code)
);

-- Consolidated Vendor Master (for risk management - cross-tenant, limited fields only)
CREATE TABLE IF NOT EXISTS vendor_master_consolidated (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id),
    vendor_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    risk_score DECIMAL(5,2),
    risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id)
);

-- MODULE 1: RFP (Bid Manager)
CREATE TABLE IF NOT EXISTS rfps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfp_number VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'closed', 'evaluating', 'awarded', 'cancelled'
    owner_id UUID NOT NULL REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    due_date TIMESTAMP,
    lock_date TIMESTAMP,
    ai_suggestions JSONB DEFAULT '[]',
    ai_suggestions_accepted JSONB DEFAULT '[]',
    ai_suggestions_rejected JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, rfp_number)
);

-- RFP Sections
CREATE TABLE IF NOT EXISTS rfp_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
    section_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    section_type VARCHAR(50), -- 'technical', 'commercial', 'legal', 'general'
    ai_generated BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RFP Vendor Invitations
CREATE TABLE IF NOT EXISTS rfp_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'submitted'
    response_deadline TIMESTAMP,
    UNIQUE(rfp_id, vendor_id)
);

-- RFP Responses
CREATE TABLE IF NOT EXISTS rfp_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'shortlisted', 'rejected', 'awarded'
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rfp_id, vendor_id)
);

-- RFP Response Sections
CREATE TABLE IF NOT EXISTS rfp_response_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL REFERENCES rfp_responses(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES rfp_sections(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(response_id, section_id)
);

-- AI Evaluation Scores
CREATE TABLE IF NOT EXISTS ai_evaluation_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL REFERENCES rfp_responses(id) ON DELETE CASCADE,
    criterion VARCHAR(255) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    weighted_score DECIMAL(10,4),
    ai_confidence DECIMAL(5,2),
    ai_rationale TEXT,
    anomalies JSONB DEFAULT '[]',
    bias_flags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evaluation Overrides (human overrides of AI scores)
CREATE TABLE IF NOT EXISTS evaluation_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES ai_evaluation_scores(id) ON DELETE CASCADE,
    overridden_by UUID NOT NULL REFERENCES users(id),
    original_score DECIMAL(5,2) NOT NULL,
    new_score DECIMAL(5,2) NOT NULL,
    rationale TEXT NOT NULL,
    override_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 2: Contracts
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_number VARCHAR(100) NOT NULL,
    rfp_id UUID REFERENCES rfps(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    contract_type VARCHAR(50) NOT NULL, -- 'MSA', 'SOW', 'PO', 'Amendment'
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'in_review', 'locked', 'signed', 'active', 'expired', 'terminated'
    template_version VARCHAR(50),
    content TEXT NOT NULL,
    ai_generated BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMP,
    signed_at TIMESTAMP,
    effective_date DATE,
    expiration_date DATE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, contract_number)
);

-- Contract Clauses
CREATE TABLE IF NOT EXISTS contract_clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    clause_number VARCHAR(50),
    title VARCHAR(255),
    content TEXT NOT NULL,
    clause_type VARCHAR(50), -- 'standard', 'custom', 'ai_generated'
    source VARCHAR(255), -- 'template', 'repository', 'prior_contract', 'generated'
    source_version VARCHAR(50),
    ai_generated BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    bias_flags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contract Versions (for versioning)
CREATE TABLE IF NOT EXISTS contract_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 3: Procurement
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_number VARCHAR(100) NOT NULL,
    contract_id UUID REFERENCES contracts(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'sent', 'acknowledged', 'fulfilled', 'cancelled'
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    line_items JSONB NOT NULL DEFAULT '[]',
    erp_system VARCHAR(50), -- 'SAP', 'Oracle', 'NetSuite', 'QuickBooks'
    erp_po_id VARCHAR(255),
    erp_sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'synced', 'failed', 'retrying'
    erp_sync_error TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, po_number)
);

-- Vendor Onboarding
CREATE TABLE IF NOT EXISTS vendor_onboarding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'initiated', -- 'initiated', 'in_progress', 'pending_approval', 'approved', 'completed', 'rejected'
    onboarding_steps JSONB NOT NULL DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    erp_vendor_id VARCHAR(255),
    erp_sync_status VARCHAR(50) DEFAULT 'pending',
    initiated_by UUID NOT NULL REFERENCES users(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 4: Performance Management
CREATE TABLE IF NOT EXISTS performance_scorecards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    overall_score DECIMAL(5,2),
    ai_generated BOOLEAN DEFAULT false,
    ai_confidence DECIMAL(5,2),
    ai_rationale TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scorecard_id UUID NOT NULL REFERENCES performance_scorecards(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2),
    target_value DECIMAL(10,2),
    unit VARCHAR(50),
    score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Penalties
CREATE TABLE IF NOT EXISTS penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id),
    penalty_type VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    reason TEXT NOT NULL,
    ai_suggested BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'applied', 'waived'
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 5: Risk Management
CREATE TABLE IF NOT EXISTS vendor_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    risk_score DECIMAL(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    assessment_date DATE NOT NULL,
    provider VARCHAR(50), -- 'Moodys', 'DnB', 'SP', 'internal'
    provider_data JSONB,
    alerts JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    source VARCHAR(50), -- 'Moodys', 'DnB', 'SP', 'internal'
    source_data JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 6: Analytics
CREATE TABLE IF NOT EXISTS analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    widgets JSONB NOT NULL DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES users(id),
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 7: Helpdesk
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ticket_number VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'dispute', 'support', 'question', 'complaint'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed', 'escalated'
    created_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    vendor_id UUID REFERENCES vendors(id),
    contract_id UUID REFERENCES contracts(id),
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    UNIQUE(tenant_id, ticket_number)
);

-- Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODULE 8: Surveys
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    survey_number VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'VOC', 'VOV' (Voice of Customer/Vendor)
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'closed', 'archived'
    questions JSONB NOT NULL DEFAULT '[]',
    target_audience JSONB DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    UNIQUE(tenant_id, survey_number)
);

-- Survey Responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    respondent_id UUID REFERENCES users(id),
    vendor_id UUID REFERENCES vendors(id),
    responses JSONB NOT NULL DEFAULT '{}',
    sentiment_score DECIMAL(5,2),
    ai_analyzed BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INTEGRATIONS
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'ERP', 'RiskProvider', 'Signature', 'DocumentRepo'
    system VARCHAR(100) NOT NULL, -- 'SAP', 'Oracle', 'NetSuite', 'Moodys', 'DocuSign', 'SharePoint'
    status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'error', 'testing'
    configuration JSONB NOT NULL DEFAULT '{}',
    field_mappings JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration Sync Logs
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'vendor', 'po', 'risk', 'document'
    direction VARCHAR(20) NOT NULL, -- 'push', 'pull', 'bidirectional'
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial', 'retrying'
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- AUDIT LOGS (Immutable, tamper-evident)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    module VARCHAR(50),
    details JSONB NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ✅ SINGLE primary key (includes partition key)
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partition for current year (example)
-- CREATE TABLE audit_logs_2024 PARTITION OF audit_logs
--     FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rfps_tenant ON rfps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rfps_owner ON rfps(owner_id);
CREATE INDEX IF NOT EXISTS idx_rfp_responses_rfp ON rfp_responses(rfp_id);
CREATE INDEX IF NOT EXISTS idx_rfp_responses_vendor ON rfp_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
