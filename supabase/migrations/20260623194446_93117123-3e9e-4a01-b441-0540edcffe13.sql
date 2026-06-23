
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Workshops table
CREATE TABLE public.workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workshops TO anon, authenticated;
GRANT ALL ON public.workshops TO service_role;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read names" ON public.workshops FOR SELECT USING (true);

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received INT NOT NULL DEFAULT 0,
  repaired INT NOT NULL DEFAULT 0,
  delivered INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- no direct access; only via security definer functions

-- Admin config (single row)
CREATE TABLE public.admin_config (
  id INT PRIMARY KEY DEFAULT 1,
  master_password_hash TEXT NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Seed admin password
INSERT INTO public.admin_config (id, master_password_hash)
VALUES (1, crypt('admin123', gen_salt('bf')));

-- Seed workshops
INSERT INTO public.workshops (name, password_hash, sort_order) VALUES
('ورشة منطقة الديوان', crypt('1234', gen_salt('bf')), 1),
('ورشة المنصورة', crypt('1234', gen_salt('bf')), 2),
('ورشة شربين', crypt('1234', gen_salt('bf')), 3),
('ورشة طلخا', crypt('1234', gen_salt('bf')), 4),
('ورشة نبروه', crypt('1234', gen_salt('bf')), 5),
('ورشة جمصة', crypt('1234', gen_salt('bf')), 6),
('ورشة المنزلة', crypt('1234', gen_salt('bf')), 7),
('ورشة ميت سلسيل', crypt('1234', gen_salt('bf')), 8),
('ورشة أجا', crypt('1234', gen_salt('bf')), 9),
('ورشة تمي الأمديد', crypt('1234', gen_salt('bf')), 10),
('ورشة السنبلاوين', crypt('1234', gen_salt('bf')), 11),
('ورشة بني عبيد', crypt('1234', gen_salt('bf')), 12),
('ورشة دكرنس', crypt('1234', gen_salt('bf')), 13),
('ورشة ميت غمر', crypt('1234', gen_salt('bf')), 14),
('ورشة بلقاس', crypt('1234', gen_salt('bf')), 15),
('ورشة منية النصر', crypt('1234', gen_salt('bf')), 16);

-- ============ FUNCTIONS ============

-- Verify workshop password, return workshop id+name
CREATE OR REPLACE FUNCTION public.login_workshop(p_workshop_id UUID, p_password TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT w.id, w.name FROM public.workshops w
  WHERE w.id = p_workshop_id
    AND w.password_hash = crypt(p_password, w.password_hash);
END; $$;
GRANT EXECUTE ON FUNCTION public.login_workshop(UUID, TEXT) TO anon, authenticated;

-- Verify admin password
CREATE OR REPLACE FUNCTION public.login_admin(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT (master_password_hash = crypt(p_password, master_password_hash))
  INTO ok FROM public.admin_config WHERE id = 1;
  RETURN COALESCE(ok, false);
END; $$;
GRANT EXECUTE ON FUNCTION public.login_admin(TEXT) TO anon, authenticated;

-- Get reports for one workshop (verifies workshop password)
CREATE OR REPLACE FUNCTION public.get_workshop_reports(p_workshop_id UUID, p_password TEXT)
RETURNS SETOF public.reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = p_workshop_id
                  AND w.password_hash = crypt(p_password, w.password_hash)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT * FROM public.reports WHERE workshop_id = p_workshop_id ORDER BY report_date DESC, created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_workshop_reports(UUID, TEXT) TO anon, authenticated;

-- Add report (workshop)
CREATE OR REPLACE FUNCTION public.add_report(
  p_workshop_id UUID, p_password TEXT, p_date DATE,
  p_received INT, p_repaired INT, p_delivered INT, p_notes TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = p_workshop_id
                  AND w.password_hash = crypt(p_password, w.password_hash)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.reports(workshop_id, report_date, received, repaired, delivered, notes)
  VALUES (p_workshop_id, COALESCE(p_date, CURRENT_DATE), GREATEST(p_received,0), GREATEST(p_repaired,0), GREATEST(p_delivered,0), p_notes)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.add_report(UUID, TEXT, DATE, INT, INT, INT, TEXT) TO anon, authenticated;

-- Admin: get all reports with workshop summary
CREATE OR REPLACE FUNCTION public.admin_get_all(p_admin_password TEXT)
RETURNS TABLE(
  workshop_id UUID, workshop_name TEXT, sort_order INT,
  total_received BIGINT, total_repaired BIGINT, total_delivered BIGINT,
  reports_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  SELECT w.id, w.name, w.sort_order,
    COALESCE(SUM(r.received),0)::BIGINT,
    COALESCE(SUM(r.repaired),0)::BIGINT,
    COALESCE(SUM(r.delivered),0)::BIGINT,
    COUNT(r.id)::BIGINT
  FROM public.workshops w
  LEFT JOIN public.reports r ON r.workshop_id = w.id
  GROUP BY w.id, w.name, w.sort_order
  ORDER BY w.sort_order;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_all(TEXT) TO anon, authenticated;

-- Admin: get all individual reports for a workshop
CREATE OR REPLACE FUNCTION public.admin_get_reports(p_admin_password TEXT, p_workshop_id UUID)
RETURNS SETOF public.reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT * FROM public.reports WHERE workshop_id = p_workshop_id ORDER BY report_date DESC, created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_get_reports(TEXT, UUID) TO anon, authenticated;

-- Admin: update workshop password
CREATE OR REPLACE FUNCTION public.admin_update_workshop_password(p_admin_password TEXT, p_workshop_id UUID, p_new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.workshops SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = p_workshop_id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_workshop_password(TEXT, UUID, TEXT) TO anon, authenticated;

-- Admin: update master password
CREATE OR REPLACE FUNCTION public.admin_update_master_password(p_old TEXT, p_new TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.login_admin(p_old) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.admin_config SET master_password_hash = crypt(p_new, gen_salt('bf')) WHERE id = 1;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_master_password(TEXT, TEXT) TO anon, authenticated;

-- Admin: update a report
CREATE OR REPLACE FUNCTION public.admin_update_report(
  p_admin_password TEXT, p_report_id UUID,
  p_date DATE, p_received INT, p_repaired INT, p_delivered INT, p_notes TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.reports SET
    report_date = COALESCE(p_date, report_date),
    received = GREATEST(p_received,0),
    repaired = GREATEST(p_repaired,0),
    delivered = GREATEST(p_delivered,0),
    notes = p_notes
  WHERE id = p_report_id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_report(TEXT, UUID, DATE, INT, INT, INT, TEXT) TO anon, authenticated;

-- Admin: delete report
CREATE OR REPLACE FUNCTION public.admin_delete_report(p_admin_password TEXT, p_report_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.reports WHERE id = p_report_id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_report(TEXT, UUID) TO anon, authenticated;
