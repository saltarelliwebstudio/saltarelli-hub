-- Striking progression tracking
CREATE TABLE IF NOT EXISTS striking_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  striking_classes_attended integer DEFAULT 0 NOT NULL,
  current_tier text DEFAULT 'basics' NOT NULL CHECK (current_tier IN ('basics', 'advanced', 'sparring')),
  tier_override boolean DEFAULT false, -- true if admin manually set the tier
  current_streak integer DEFAULT 0,  -- consecutive weeks attended
  longest_streak integer DEFAULT 0,
  last_class_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pod_id, user_id)
);

-- Attendance log for striking classes
CREATE TABLE IF NOT EXISTS striking_attendance_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_name text NOT NULL,
  attended_at date NOT NULL DEFAULT CURRENT_DATE,
  marked_by uuid REFERENCES auth.users(id), -- who marked it (admin or self)
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sp_pod_user ON striking_progress(pod_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sal_pod_user ON striking_attendance_log(pod_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sal_attended ON striking_attendance_log(attended_at DESC);

-- RLS
ALTER TABLE striking_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE striking_attendance_log ENABLE ROW LEVEL SECURITY;

-- Admins see all
CREATE POLICY "Admins full access striking_progress" ON striking_progress
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins full access striking_attendance_log" ON striking_attendance_log
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Members see own
CREATE POLICY "Members view own progress" ON striking_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Members view own attendance" ON striking_attendance_log
  FOR SELECT USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role striking_progress" ON striking_progress
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role striking_attendance_log" ON striking_attendance_log
  FOR ALL USING (auth.role() = 'service_role');

-- Function to auto-update tier based on class count
CREATE OR REPLACE FUNCTION update_striking_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-update if not manually overridden
  IF NOT NEW.tier_override THEN
    IF NEW.striking_classes_attended >= 30 THEN
      NEW.current_tier := 'sparring';
    ELSIF NEW.striking_classes_attended >= 20 THEN
      NEW.current_tier := 'advanced';
    ELSE
      NEW.current_tier := 'basics';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_striking_tier
  BEFORE UPDATE ON striking_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_striking_tier();
