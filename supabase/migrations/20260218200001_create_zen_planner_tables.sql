-- Zen Planner schedule data synced from Zen Planner API
CREATE TABLE IF NOT EXISTS zen_planner_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE NOT NULL,
  class_name text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time time NOT NULL,
  end_time time NOT NULL,
  instructor text,
  is_new boolean DEFAULT false,
  synced_at timestamptz DEFAULT now()
);

-- Zen Planner attendance records
CREATE TABLE IF NOT EXISTS zen_planner_attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE NOT NULL,
  member_name text NOT NULL,
  class_name text NOT NULL,
  check_in_at timestamptz NOT NULL,
  synced_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zp_schedule_pod ON zen_planner_schedule(pod_id);
CREATE INDEX IF NOT EXISTS idx_zp_attendance_pod ON zen_planner_attendance(pod_id);
CREATE INDEX IF NOT EXISTS idx_zp_attendance_checkin ON zen_planner_attendance(check_in_at DESC);

-- RLS
ALTER TABLE zen_planner_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_planner_attendance ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY "Admins can view all schedule" ON zen_planner_schedule
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all attendance" ON zen_planner_attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Clients can see their own pod data
CREATE POLICY "Clients can view own schedule" ON zen_planner_schedule
  FOR SELECT USING (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can view own attendance" ON zen_planner_attendance
  FOR SELECT USING (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
  );

-- Service role can do everything (for sync script)
CREATE POLICY "Service role full access schedule" ON zen_planner_schedule
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access attendance" ON zen_planner_attendance
  FOR ALL USING (auth.role() = 'service_role');
