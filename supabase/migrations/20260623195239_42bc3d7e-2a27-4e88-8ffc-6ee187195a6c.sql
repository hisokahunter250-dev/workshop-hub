
-- Move pgcrypto into extensions schema if needed, and update search_path on all functions
CREATE SCHEMA IF NOT EXISTS extensions;
-- pgcrypto already created; ensure functions can find crypt() and gen_salt()

ALTER FUNCTION public.login_workshop(uuid, text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.login_admin(text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.get_workshop_reports(uuid, text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.add_report(uuid, text, date, integer, integer, integer, text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.admin_get_all(text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.admin_get_reports(text, uuid) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.admin_update_workshop_password(text, uuid, text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.admin_update_master_password(text, text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.admin_update_report(text, uuid, date, integer, integer, integer, text) SET search_path = public, extensions, pg_catalog;
ALTER FUNCTION public.admin_delete_report(text, uuid) SET search_path = public, extensions, pg_catalog;
