
-- 1) Settings table (single row)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  theme text NOT NULL DEFAULT 'dark',
  notification_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read settings" ON public.app_settings;
CREATE POLICY "public read settings" ON public.app_settings FOR SELECT USING (true);
INSERT INTO public.app_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2) Admin users table (sub-admins with scoped permissions)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No policies: accessed only through SECURITY DEFINER RPCs

-- 3) Permission checker: master pw OR sub-admin with the perm
CREATE OR REPLACE FUNCTION public.check_admin_perm(p_password text, p_perm text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF public.login_admin(p_password) THEN RETURN true; END IF;
  RETURN EXISTS(
    SELECT 1 FROM public.admin_users au
    WHERE au.password_hash = crypt(p_password, au.password_hash)
      AND p_perm = ANY(au.permissions)
  );
END; $$;

-- 4) Combined login: returns is_master + permissions
CREATE OR REPLACE FUNCTION public.admin_login(p_password text)
RETURNS TABLE(is_master boolean, username text, permissions text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF public.login_admin(p_password) THEN
    RETURN QUERY SELECT true, 'master'::text,
      ARRAY['view_reports','edit_reports','manage_workshop_passwords','manage_settings']::text[];
    RETURN;
  END IF;
  RETURN QUERY
    SELECT false, au.username, au.permissions
    FROM public.admin_users au
    WHERE au.password_hash = crypt(p_password, au.password_hash)
    LIMIT 1;
END; $$;

-- 5) Update existing admin_* functions to use permission checks
CREATE OR REPLACE FUNCTION public.admin_get_all(p_admin_password text)
RETURNS TABLE(workshop_id uuid, workshop_name text, sort_order integer, total_received bigint, total_repaired bigint, total_delivered bigint, reports_count bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'view_reports') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
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

CREATE OR REPLACE FUNCTION public.admin_get_reports(p_admin_password text, p_workshop_id uuid)
RETURNS SETOF reports
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'view_reports') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.reports WHERE workshop_id = p_workshop_id ORDER BY report_date DESC, created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_report(p_admin_password text, p_report_id uuid, p_date date, p_received integer, p_repaired integer, p_delivered integer, p_notes text, p_extra jsonb DEFAULT NULL::jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'edit_reports') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
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

CREATE OR REPLACE FUNCTION public.admin_delete_report(p_admin_password text, p_report_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'edit_reports') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.reports WHERE id = p_report_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_workshop_password(p_admin_password text, p_workshop_id uuid, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_workshop_passwords') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.workshops SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = p_workshop_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_fields(p_admin_password text)
RETURNS SETOF field_configs
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT * FROM public.field_configs ORDER BY sort_order, created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_field_label(p_admin_password text, p_field_id uuid, p_label text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.field_configs SET label = p_label WHERE id = p_field_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_add_field(p_admin_password text, p_key text, p_label text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE new_id uuid; next_order integer;
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_key !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN RAISE EXCEPTION 'Invalid key'; END IF;
  SELECT COALESCE(MAX(sort_order),0)+1 INTO next_order FROM public.field_configs;
  INSERT INTO public.field_configs(key, label, sort_order, is_builtin)
  VALUES (p_key, p_label, next_order, false) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_field(p_admin_password text, p_field_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.field_configs WHERE id = p_field_id AND is_builtin = false;
  RETURN true;
END; $$;

-- 6) Add workshop
CREATE OR REPLACE FUNCTION public.admin_add_workshop(p_admin_password text, p_name text, p_password text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE new_id uuid; next_order integer;
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_workshop_passwords') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF length(p_password) < 3 THEN RAISE EXCEPTION 'Password too short'; END IF;
  SELECT COALESCE(MAX(sort_order),0)+1 INTO next_order FROM public.workshops;
  INSERT INTO public.workshops(name, password_hash, sort_order)
  VALUES (trim(p_name), crypt(p_password, gen_salt('bf')), next_order)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_workshop(p_admin_password text, p_workshop_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_workshop_passwords') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.workshops WHERE id = p_workshop_id;
  RETURN true;
END; $$;

-- 7) Sub-admin management (requires manage_settings)
CREATE OR REPLACE FUNCTION public.admin_list_admins(p_admin_password text)
RETURNS TABLE(id uuid, username text, permissions text[], created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY SELECT au.id, au.username, au.permissions, au.created_at FROM public.admin_users au ORDER BY au.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_add_admin(p_admin_password text, p_username text, p_password text, p_permissions text[])
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF length(trim(p_username)) < 2 THEN RAISE EXCEPTION 'Invalid username'; END IF;
  IF length(p_password) < 4 THEN RAISE EXCEPTION 'Password too short'; END IF;
  INSERT INTO public.admin_users(username, password_hash, permissions)
  VALUES (trim(p_username), crypt(p_password, gen_salt('bf')), COALESCE(p_permissions, '{}'))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_admin(p_admin_password text, p_admin_id uuid, p_new_password text, p_permissions text[])
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.admin_users SET
    password_hash = CASE WHEN p_new_password IS NOT NULL AND length(p_new_password) >= 4
                         THEN crypt(p_new_password, gen_salt('bf')) ELSE password_hash END,
    permissions = COALESCE(p_permissions, permissions)
  WHERE id = p_admin_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_admin(p_admin_password text, p_admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.admin_users WHERE id = p_admin_id;
  RETURN true;
END; $$;

-- 8) Settings get/update
CREATE OR REPLACE FUNCTION public.get_settings()
RETURNS TABLE(theme text, notification_email text)
LANGUAGE sql STABLE
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT theme, notification_email FROM public.app_settings WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_settings(p_admin_password text, p_theme text, p_notification_email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  IF NOT public.check_admin_perm(p_admin_password,'manage_settings') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_theme NOT IN ('dark','light') THEN RAISE EXCEPTION 'Invalid theme'; END IF;
  UPDATE public.app_settings SET
    theme = p_theme,
    notification_email = NULLIF(trim(p_notification_email), ''),
    updated_at = now()
  WHERE id = 1;
  RETURN true;
END; $$;
