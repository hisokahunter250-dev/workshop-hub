import { supabase } from "@/integrations/supabase/client";

export type Workshop = { id: string; name: string; sort_order: number };
export type Report = {
  id: string;
  workshop_id: string;
  report_date: string;
  received: number;
  repaired: number;
  delivered: number;
  notes: string | null;
  created_at: string;
  extra?: Record<string, number> | null;
};
export type AdminSummary = {
  workshop_id: string;
  workshop_name: string;
  sort_order: number;
  total_received: number;
  total_repaired: number;
  total_delivered: number;
  reports_count: number;
};
export type FieldConfig = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_builtin: boolean;
};

export const BUILTIN_KEYS = ["received", "repaired", "delivered"] as const;
export type BuiltinKey = (typeof BUILTIN_KEYS)[number];

export async function listFields(): Promise<FieldConfig[]> {
  const { data, error } = await supabase
    .from("field_configs")
    .select("id, key, label, sort_order, is_builtin")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as FieldConfig[];
}

export async function adminListFields(adminPassword: string): Promise<FieldConfig[]> {
  const { data, error } = await supabase.rpc("admin_list_fields", { p_admin_password: adminPassword });
  if (error) throw error;
  return (data as FieldConfig[]) ?? [];
}
export async function adminUpdateFieldLabel(adminPassword: string, fieldId: string, label: string) {
  const { error } = await supabase.rpc("admin_update_field_label", {
    p_admin_password: adminPassword, p_field_id: fieldId, p_label: label,
  });
  if (error) throw error;
}
export async function adminAddField(adminPassword: string, key: string, label: string) {
  const { error } = await supabase.rpc("admin_add_field", {
    p_admin_password: adminPassword, p_key: key, p_label: label,
  });
  if (error) throw error;
}
export async function adminDeleteField(adminPassword: string, fieldId: string) {
  const { error } = await supabase.rpc("admin_delete_field", {
    p_admin_password: adminPassword, p_field_id: fieldId,
  });
  if (error) throw error;
}

export async function listWorkshops(): Promise<Workshop[]> {
  const { data, error } = await supabase
    .from("workshops")
    .select("id, name, sort_order")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function loginWorkshop(workshopId: string, password: string) {
  const { data, error } = await supabase.rpc("login_workshop", {
    p_workshop_id: workshopId,
    p_password: password,
  });
  if (error) throw error;
  return (data && data.length > 0) ? data[0] as { id: string; name: string } : null;
}

export async function loginAdmin(password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("login_admin", { p_password: password });
  if (error) throw error;
  return !!data;
}

export async function getWorkshopReports(workshopId: string, password: string): Promise<Report[]> {
  const { data, error } = await supabase.rpc("get_workshop_reports", {
    p_workshop_id: workshopId, p_password: password,
  });
  if (error) throw error;
  return (data as Report[]) ?? [];
}

export async function addReport(args: {
  workshopId: string; password: string; date: string;
  received: number; repaired: number; delivered: number; notes?: string;
}) {
  const { data, error } = await supabase.rpc("add_report", {
    p_workshop_id: args.workshopId,
    p_password: args.password,
    p_date: args.date,
    p_received: args.received,
    p_repaired: args.repaired,
    p_delivered: args.delivered,
    p_notes: (args.notes ?? "") as string,
  });
  if (error) throw error;
  return data as string;
}

export async function adminGetAll(adminPassword: string): Promise<AdminSummary[]> {
  const { data, error } = await supabase.rpc("admin_get_all", { p_admin_password: adminPassword });
  if (error) throw error;
  return (data as AdminSummary[]) ?? [];
}

export async function adminGetReports(adminPassword: string, workshopId: string): Promise<Report[]> {
  const { data, error } = await supabase.rpc("admin_get_reports", {
    p_admin_password: adminPassword, p_workshop_id: workshopId,
  });
  if (error) throw error;
  return (data as Report[]) ?? [];
}

export async function adminUpdateWorkshopPassword(adminPassword: string, workshopId: string, newPassword: string) {
  const { error } = await supabase.rpc("admin_update_workshop_password", {
    p_admin_password: adminPassword, p_workshop_id: workshopId, p_new_password: newPassword,
  });
  if (error) throw error;
}

export async function adminUpdateMasterPassword(oldPass: string, newPass: string) {
  const { error } = await supabase.rpc("admin_update_master_password", { p_old: oldPass, p_new: newPass });
  if (error) throw error;
}

export async function adminUpdateReport(args: {
  adminPassword: string; reportId: string; date: string;
  received: number; repaired: number; delivered: number; notes?: string;
}) {
  const { error } = await supabase.rpc("admin_update_report", {
    p_admin_password: args.adminPassword,
    p_report_id: args.reportId,
    p_date: args.date,
    p_received: args.received,
    p_repaired: args.repaired,
    p_delivered: args.delivered,
    p_notes: (args.notes ?? "") as string,
  });
  if (error) throw error;
}

export async function adminDeleteReport(adminPassword: string, reportId: string) {
  const { error } = await supabase.rpc("admin_delete_report", {
    p_admin_password: adminPassword, p_report_id: reportId,
  });
  if (error) throw error;
}
