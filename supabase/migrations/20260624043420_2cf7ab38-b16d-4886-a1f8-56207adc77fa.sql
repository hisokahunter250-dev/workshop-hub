
-- 1) field_configs
CREATE TABLE public.field_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.field_configs TO anon, authenticated;
GRANT ALL ON public.field_configs TO service_role;

ALTER TABLE public.field_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read field_configs" ON public.field_configs FOR SELECT USING (true);

-- seed builtin
INSERT INTO public.field_configs (key, label, sort_order, is_builtin) VALUES
  ('received', 'الوارد للصيانة', 1, true),
  ('repaired', 'تم تصليحه', 2, true),
  ('delivered', 'تم تسليمه للمركز', 3, true);

-- 2) extra jsonb on reports
ALTER TABLE public.reports ADD COLUMN extra jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) update add_report to accept extra
CREATE OR REPLACE FUNCTION public.add_report(
  p_workshop_id uuid, p_password text, p_date date,
  p_received integer, p_repaired integer, p_delivered integer,
  p_notes text, p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','extensions','pg_catalog'
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workshops w
                 WHERE w.id = p_workshop_id
                   AND w.password_hash = crypt(p_password, w.password_hash)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.reports(workshop_id, report_date, received, repaired, delivered, notes, extra)
  VALUES (p_workshop_id, COALESCE(p_date, CURRENT_DATE),
          GREATEST(p_received,0), GREATEST(p_repaired,0), GREATEST(p_delivered,0),
          p_notes, COALESCE(p_extra,'{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- 4) update admin_update_report
CREATE OR REPLACE FUNCTION public.admin_update_report(
  p_admin_password text, p_report_id uuid, p_date date,
  p_received integer, p_repaired integer, p_delivered integer,
  p_notes text, p_extra jsonb DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','extensions','pg_catalog'
AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.reports SET
    report_date = COALESCE(p_date, report_date),
    received = GREATEST(p_received,0),
    repaired = GREATEST(p_repaired,0),
    delivered = GREATEST(p_delivered,0),
    notes = p_notes,
    extra = COALESCE(p_extra, extra)
  WHERE id = p_report_id;
  RETURN true;
END; $$;

-- 5) admin manage fields
CREATE OR REPLACE FUNCTION public.admin_list_fields(p_admin_password text)
RETURNS SETOF public.field_configs
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_catalog'
AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.field_configs ORDER BY sort_order, created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_field_label(
  p_admin_password text, p_field_id uuid, p_label text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_catalog'
AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.field_configs SET label = p_label WHERE id = p_field_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_add_field(
  p_admin_password text, p_key text, p_label text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_catalog'
AS $$
DECLARE new_id uuid; next_order integer;
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_key !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN RAISE EXCEPTION 'Invalid key'; END IF;
  SELECT COALESCE(MAX(sort_order),0)+1 INTO next_order FROM public.field_configs;
  INSERT INTO public.field_configs(key, label, sort_order, is_builtin)
  VALUES (p_key, p_label, next_order, false) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_field(
  p_admin_password text, p_field_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions','pg_catalog'
AS $$
BEGIN
  IF NOT public.login_admin(p_admin_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.field_configs WHERE id = p_field_id AND is_builtin = false;
  RETURN true;
END; $$;
