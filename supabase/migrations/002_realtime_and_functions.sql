-- Realtime subscriptions and database functions
-- Enable realtime on key tables for live updates

-- Enable realtime on tasks for live task updates
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Enable realtime on visits for live visit tracking
ALTER PUBLICATION supabase_realtime ADD TABLE visits;

-- Enable realtime on leaderboard for live leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;

-- Function: Calculate leaderboard for a division
-- Called after visits are recorded to update rankings
CREATE OR REPLACE FUNCTION calculate_division_leaderboard(
    p_division_id UUID,
    p_period_type VARCHAR
)
RETURNS TABLE (
    rep_id UUID,
    rank INTEGER,
    visits_count INTEGER,
    revenue_total DECIMAL,
    conversion_rate DECIMAL
) AS $$
DECLARE
    v_period_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Determine period start based on type
    CASE p_period_type
        WHEN 'daily' THEN
            v_period_start := DATE_TRUNC('day', NOW());
        WHEN 'weekly' THEN
            v_period_start := DATE_TRUNC('week', NOW());
        WHEN 'monthly' THEN
            v_period_start := DATE_TRUNC('month', NOW());
        ELSE
            v_period_start := DATE_TRUNC('month', NOW());
    END CASE;

    RETURN QUERY
    WITH visit_stats AS (
        SELECT
            rep_id,
            COUNT(*) as visit_count,
            SUM(COALESCE(revenue_generated, 0)) as total_revenue,
            COUNT(CASE WHEN revenue_generated > 0 THEN 1 END)::DECIMAL /
                NULLIF(COUNT(*), 0) as conversion_rate
        FROM visits
        WHERE division_id = p_division_id
            AND created_at >= v_period_start
        GROUP BY rep_id
    ),
    ranked_reps AS (
        SELECT
            rep_id,
            visit_count,
            total_revenue,
            conversion_rate,
            ROW_NUMBER() OVER (ORDER BY total_revenue DESC, visit_count DESC) as rank
        FROM visit_stats
    )
    SELECT
        rep_id,
        rank::INTEGER,
        visit_count::INTEGER,
        total_revenue,
        conversion_rate
    FROM ranked_reps;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update leaderboard table after visit creation
CREATE OR REPLACE FUNCTION update_leaderboard_on_visit()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO leaderboard (division_id, rep_id, period_type, period_start, rank, visits_count, revenue_total, conversion_rate)
    SELECT
        NEW.division_id,
        stats.rep_id,
        'daily',
        DATE_TRUNC('day', NOW()),
        stats.rank,
        stats.visits_count,
        stats.revenue_total,
        stats.conversion_rate
    FROM calculate_division_leaderboard(NEW.division_id, 'daily') stats
    WHERE stats.rep_id = NEW.rep_id
    ON CONFLICT (division_id, rep_id, period_type, period_start)
    DO UPDATE SET
        rank = EXCLUDED.rank,
        visits_count = EXCLUDED.visits_count,
        revenue_total = EXCLUDED.revenue_total,
        conversion_rate = EXCLUDED.conversion_rate,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update leaderboard on visit insert
CREATE TRIGGER trigger_update_leaderboard_on_visit
AFTER INSERT ON visits
FOR EACH ROW
EXECUTE FUNCTION update_leaderboard_on_visit();

-- Function: Get customer profile (aggregates customer data)
CREATE OR REPLACE FUNCTION get_customer_profile(p_customer_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    address TEXT,
    service_type VARCHAR,
    last_visit_date TIMESTAMP WITH TIME ZONE,
    total_visits INTEGER,
    total_revenue DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.address,
        c.service_type::VARCHAR,
        c.last_visit_date,
        COUNT(v.id)::INTEGER as visit_count,
        COALESCE(SUM(v.revenue_generated), 0) as revenue
    FROM customers c
    LEFT JOIN visits v ON c.id = v.customer_id
    WHERE c.id = p_customer_id
    GROUP BY c.id, c.name, c.phone, c.email, c.address, c.service_type, c.last_visit_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get rep performance metrics
CREATE OR REPLACE FUNCTION get_rep_performance(
    p_rep_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    visits_count INTEGER,
    revenue_total DECIMAL,
    avg_revenue_per_visit DECIMAL,
    tasks_completed INTEGER,
    task_completion_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(v.id)::INTEGER as visits,
        COALESCE(SUM(v.revenue_generated), 0)::DECIMAL as revenue,
        COALESCE(AVG(v.revenue_generated), 0)::DECIMAL as avg_revenue,
        COUNT(t.id)::INTEGER as tasks_done,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::DECIMAL /
            NULLIF(COUNT(t.id), 0) as completion_rate
    FROM visits v
    LEFT JOIN tasks t ON v.rep_id = t.rep_id
        AND t.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
    WHERE v.rep_id = p_rep_id
        AND v.created_at >= NOW() - (p_days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Archive old sync queue records
CREATE OR REPLACE FUNCTION archive_old_sync_records()
RETURNS void AS $$
BEGIN
    DELETE FROM sync_queue
    WHERE status = 'synced'
        AND synced_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function: Update customer last_visit_date on visit creation
CREATE OR REPLACE FUNCTION update_customer_last_visit()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET last_visit_date = NEW.ended_at
    WHERE id = NEW.customer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update customer last visit date
CREATE TRIGGER trigger_update_customer_last_visit
AFTER INSERT ON visits
FOR EACH ROW
EXECUTE FUNCTION update_customer_last_visit();

-- Create scheduled job for daily leaderboard calculation (executed via cron)
-- This would be set up via Supabase Extensions or n8n
-- CALL cron.schedule('daily_leaderboard_calc', '0 6 * * *', 'SELECT calculate_division_leaderboard(id, ''daily'') FROM divisions');
