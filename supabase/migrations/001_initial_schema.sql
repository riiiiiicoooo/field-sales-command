-- Initial schema for Field Sales Command platform
-- Creates core tables with RLS policies and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role_enum AS ENUM ('admin', 'manager', 'rep', 'regional_director');
CREATE TYPE task_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_type_enum AS ENUM ('follow_up', 'upsell', 'issue', 'check_in', 'other');
CREATE TYPE sync_operation_type AS ENUM ('create_task', 'complete_task', 'record_visit', 'update_customer');
CREATE TYPE sync_status_enum AS ENUM ('pending', 'synced', 'failed');
CREATE TYPE service_type_enum AS ENUM ('pest_control', 'lawn_care', 'termite_treatment', 'other');
CREATE TYPE period_type_enum AS ENUM ('daily', 'weekly', 'monthly');

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    division_id UUID NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'rep',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_division_id (division_id),
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
);

-- Divisions table
CREATE TABLE IF NOT EXISTS divisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    president_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_divisions_region (region)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    division_id UUID NOT NULL REFERENCES divisions(id),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    service_type service_type_enum,
    jde_account_id VARCHAR(50),
    sf_lead_id VARCHAR(50),
    predicted_ltv DECIMAL(12, 2),
    churn_risk DECIMAL(3, 2),
    last_visit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customers_division_id (division_id),
    INDEX idx_customers_name (name),
    INDEX idx_customers_jde_account_id (jde_account_id),
    INDEX idx_customers_sf_lead_id (sf_lead_id),
    INDEX idx_customers_service_type (service_type),
    INDEX idx_customers_churn_risk (churn_risk)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID NOT NULL REFERENCES users(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    division_id UUID NOT NULL REFERENCES divisions(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type task_type_enum NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status task_status_enum NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tasks_rep_id (rep_id),
    INDEX idx_tasks_customer_id (customer_id),
    INDEX idx_tasks_division_id (division_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_due_date (due_date),
    INDEX idx_tasks_rep_status (rep_id, status)
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID NOT NULL REFERENCES users(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    division_id UUID NOT NULL REFERENCES divisions(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy_meters INTEGER,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER,
    tasks_completed INTEGER DEFAULT 0,
    revenue_generated DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_visits_rep_id (rep_id),
    INDEX idx_visits_customer_id (customer_id),
    INDEX idx_visits_division_id (division_id),
    INDEX idx_visits_created_at (created_at),
    INDEX idx_visits_rep_created_at (rep_id, created_at),
    INDEX idx_visits_coordinates (latitude, longitude)
);

-- Leaderboard table (pre-calculated)
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    division_id UUID NOT NULL REFERENCES divisions(id),
    rep_id UUID NOT NULL REFERENCES users(id),
    period_type period_type_enum NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rank INTEGER NOT NULL,
    visits_count INTEGER DEFAULT 0,
    revenue_total DECIMAL(12, 2) DEFAULT 0,
    conversion_rate DECIMAL(3, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (division_id, rep_id, period_type, period_start),
    INDEX idx_leaderboard_division_id (division_id),
    INDEX idx_leaderboard_rep_id (rep_id),
    INDEX idx_leaderboard_period (period_type, period_start),
    INDEX idx_leaderboard_rank (division_id, rank)
);

-- Sync queue table
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) NOT NULL,
    operation_type sync_operation_type NOT NULL,
    payload JSONB NOT NULL,
    status sync_status_enum DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITH TIME ZONE,
    INDEX idx_sync_queue_device_id (device_id),
    INDEX idx_sync_queue_status (status),
    INDEX idx_sync_queue_created_at (created_at)
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view themselves" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Managers can view division users" ON users
    FOR SELECT USING (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
        AND (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin', 'regional_director')
    );

-- RLS Policies for customers table
CREATE POLICY "Reps can view division customers" ON customers
    FOR SELECT USING (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Reps can update customers" ON customers
    FOR UPDATE USING (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
    );

-- RLS Policies for tasks table
CREATE POLICY "Reps can view their own tasks" ON tasks
    FOR SELECT USING (
        rep_id = auth.uid()
        OR (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
    );

CREATE POLICY "Reps can create tasks in their division" ON tasks
    FOR INSERT WITH CHECK (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Reps can update their tasks" ON tasks
    FOR UPDATE USING (
        rep_id = auth.uid()
        OR (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
    );

-- RLS Policies for visits table
CREATE POLICY "Reps can view division visits" ON visits
    FOR SELECT USING (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Reps can create visits" ON visits
    FOR INSERT WITH CHECK (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Reps can view their own visits" ON visits
    FOR SELECT USING (
        rep_id = auth.uid()
        OR (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
    );

-- RLS Policies for leaderboard
CREATE POLICY "Division users can view leaderboard" ON leaderboard
    FOR SELECT USING (
        division_id = (SELECT division_id FROM users WHERE id = auth.uid())
    );

-- RLS Policies for sync_queue
CREATE POLICY "Users can view their own sync queue" ON sync_queue
    FOR SELECT USING (
        device_id = (SELECT id::text FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert sync operations" ON sync_queue
    FOR INSERT WITH CHECK (true);
