
-- Workshop can change its own password
CREATE OR REPLACE FUNCTION public.workshop_change_password(
  p_workshop_id uuid, p_old_password text, p_new_password text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_catalog'
AS $$
BEGIN
  IF length(p_new_password) < 3 THEN RAISE EXCEPTION 'كلمة المرور قصيرة'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workshops w
                 WHERE w.id = p_workshop_id
                   AND w.password_hash = crypt(p_old_password, w.password_hash)) THEN
    RAISE EXCEPTION 'كلمة المرور الحالية غير صحيحة';
  END IF;
  UPDATE public.workshops SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_workshop_id;
  RETURN true;
END $$;

-- Rebuild admin_get_all to include last_report_at
DROP FUNCTION IF EXISTS public.admin_get_all(text);
CREATE OR REPLACE FUNCTION public.admin_get_all(p_admin_password text)
RETURNS TABLE(
  workshop_id uuid, workshop_name text, sort_order integer,
  total_received bigint, total_repaired bigint, total_delivered bigint,
  reports_count bigint, last_report_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_catalog'
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'view_reports') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
  SELECT w.id, w.name, w.sort_order,
    COALESCE(SUM(r.received),0)::BIGINT,
    COALESCE(SUM(r.repaired),0)::BIGINT,
    COALESCE(SUM(r.delivered),0)::BIGINT,
    COUNT(r.id)::BIGINT,
    MAX(r.created_at)
  FROM public.workshops w
  LEFT JOIN public.reports r ON r.workshop_id = w.id
  GROUP BY w.id, w.name, w.sort_order
  ORDER BY w.sort_order;
END $$;

-- Admin import: insert a single report row bypassing workshop password
CREATE OR REPLACE FUNCTION public.admin_import_report(
  p_admin_password text, p_workshop_id uuid, p_date date,
  p_received integer, p_repaired integer, p_delivered integer,
  p_notes text, p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','extensions','pg_catalog'
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'edit_reports') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.reports(workshop_id, report_date, received, repaired, delivered, notes, extra)
  VALUES (p_workshop_id, COALESCE(p_date, CURRENT_DATE),
          GREATEST(COALESCE(p_received,0),0), GREATEST(COALESCE(p_repaired,0),0),
          GREATEST(COALESCE(p_delivered,0),0), p_notes, COALESCE(p_extra,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
