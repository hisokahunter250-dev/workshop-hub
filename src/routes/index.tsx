import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listWorkshops, loginWorkshop, adminLogin,
  getWorkshopReports, addReport,
  adminGetAll, adminGetReports, adminUpdateWorkshopPassword,
  adminUpdateMasterPassword, adminUpdateReport, adminDeleteReport,
  listFields, adminListFields, adminUpdateFieldLabel, adminAddField, adminDeleteField,
  adminAddWorkshop, adminDeleteWorkshop,
  adminListAdmins, adminAddAdmin, adminUpdateAdmin, adminDeleteAdmin,
  getSettings, adminUpdateSettings,
  workshopChangePassword,
  ALL_PERMISSIONS,
  BUILTIN_KEYS,
  type Workshop, type Report, type AdminSummary, type FieldConfig,
  type PermissionKey, type AdminUser,
} from "@/lib/api";
import { exportAdminExcel, exportAdminPDF, exportDailyPDF, importAdminExcel } from "@/lib/export";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نظام تقارير الورش — صيانة العدادات" },
      { name: "description", content: "نظام إدارة تقارير صيانة العدادات للورش" },
    ],
  }),
  component: HomePage,
});

type Session =
  | { kind: "none" }
  | { kind: "workshop"; id: string; name: string; password: string }
  | { kind: "admin"; password: string; isMaster: boolean; username: string; permissions: PermissionKey[] };

const SESSION_KEY = "workshop_session_v2";

function loadSession(): Session {
  if (typeof window === "undefined") return { kind: "none" };
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return { kind: "none" };
    return JSON.parse(s);
  } catch { return { kind: "none" }; }
}
function saveSession(s: Session) {
  if (typeof window === "undefined") return;
  if (s.kind === "none") localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function useFields() {
  return useQuery({ queryKey: ["fields"], queryFn: listFields, staleTime: 30_000 });
}
function labelFor(fields: FieldConfig[], key: string, fallback: string) {
  return fields.find(f => f.key === key)?.label ?? fallback;
}
function customFields(fields: FieldConfig[]) {
  return fields.filter(f => !f.is_builtin);
}

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

function HomePage() {
  const [session, setSession] = useState<Session>({ kind: "none" });
  useEffect(() => { setSession(loadSession()); }, []);
  function setAndSave(s: Session) { setSession(s); saveSession(s); }

  // Apply persisted theme from DB
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: 30_000 });
  useEffect(() => { if (settings?.theme) applyTheme(settings.theme); }, [settings?.theme]);

  return (
    <div className="min-h-screen">
      <Header session={session} onLogout={() => setAndSave({ kind: "none" })} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        {session.kind === "none" && <LoginScreen onLogin={setAndSave} />}
        {session.kind === "workshop" && <WorkshopView session={session} onLogout={() => setAndSave({ kind: "none" })} onSessionUpdate={setAndSave} />}
        {session.kind === "admin" && <AdminView session={session} />}
      </main>
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        نظام تقارير الورش © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function Header({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <header className="border-b border-border/40 backdrop-blur-md sticky top-0 z-30 header-bg">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl btn-primary-grad grid place-items-center text-lg">⚙</div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold gradient-text leading-tight">نظام تقارير الورش</h1>
            <p className="text-xs text-muted-foreground">صيانة العدادات — محافظة الدقهلية</p>
          </div>
        </div>
        {session.kind !== "none" && (
          <button onClick={onLogout} className="rounded-lg border border-border bg-secondary/60 px-4 py-2 text-sm hover:bg-secondary">
            تسجيل الخروج
          </button>
        )}
      </div>
    </header>
  );
}

// ============ LOGIN ============
function LoginScreen({ onLogin }: { onLogin: (s: Session) => void }) {
  const [mode, setMode] = useState<"workshop" | "admin">("workshop");
  const { data: workshops, isLoading } = useQuery({ queryKey: ["workshops"], queryFn: listWorkshops });
  return (
    <div className="grid gap-8 lg:grid-cols-2 items-start mt-4">
      <section>
        <p className="text-sm text-primary font-semibold mb-3">منصة مركزية</p>
        <h2 className="text-4xl sm:text-5xl font-black leading-tight">
          تقارير صيانة العدادات <br />
          <span className="gradient-text">لكل الورش في مكان واحد</span>
        </h2>
        <p className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-xl">
          كل ورشة تدخل ببياناتها وتسجل: العدد الوارد، ما تم تصليحه، وما تم تسليمه للمركز.
          الأدمن يطلع على إحصائيات كل الورش، يدير الحقول، الورش، وكلمات المرور.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
          <Stat label="ورشة" value={`${workshops?.length ?? 16}`} />
          <Stat label="آمن" value="🔒" />
          <Stat label="فوري" value="⚡" />
        </div>
      </section>
      <section className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex gap-2 p-1 rounded-xl bg-secondary/60 mb-6">
          <TabBtn active={mode === "workshop"} onClick={() => setMode("workshop")}>دخول ورشة</TabBtn>
          <TabBtn active={mode === "admin"} onClick={() => setMode("admin")}>دخول الأدمن</TabBtn>
        </div>
        {mode === "workshop"
          ? <WorkshopLogin workshops={workshops ?? []} loading={isLoading} onLogin={onLogin} />
          : <AdminLogin onLogin={onLogin} />}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-2xl font-bold gradient-text">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${active ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function WorkshopLogin({ workshops, loading, onLogin }: { workshops: Workshop[]; loading: boolean; onLogin: (s: Session) => void }) {
  const [wsId, setWsId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!wsId || !password) { toast.error("اختر الورشة وأدخل كلمة المرور"); return; }
    setSubmitting(true);
    try {
      const ws = await loginWorkshop(wsId, password);
      if (!ws) { toast.error("كلمة المرور غير صحيحة"); return; }
      toast.success(`أهلاً بـ ${ws.name}`);
      onLogin({ kind: "workshop", id: ws.id, name: ws.name, password });
    } catch (e: any) { toast.error(e.message ?? "خطأ"); }
    finally { setSubmitting(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="الورشة">
        <select value={wsId} onChange={e => setWsId(e.target.value)} className="w-full rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary">
          <option value="">{loading ? "جاري التحميل..." : "اختر ورشتك"}</option>
          {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <Field label="كلمة المرور">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" className="w-full rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary" />
      </Field>
      <button disabled={submitting} className="w-full btn-primary-grad rounded-lg px-4 py-3 text-sm">
        {submitting ? "جاري الدخول..." : "دخول الورشة"}
      </button>
      <p className="text-xs text-muted-foreground text-center">كلمة المرور الافتراضية للورش: <code className="text-primary">1234</code></p>
    </form>
  );
}

function AdminLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await adminLogin(password);
      if (!res) { toast.error("كلمة مرور الأدمن غير صحيحة"); return; }
      toast.success(res.isMaster ? "أهلاً أيها المدير الرئيسي" : `أهلاً ${res.username}`);
      onLogin({ kind: "admin", password, isMaster: res.isMaster, username: res.username, permissions: res.permissions });
    } catch (e: any) { toast.error(e.message ?? "خطأ"); }
    finally { setSubmitting(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="كلمة مرور الأدمن">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" className="w-full rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary" />
      </Field>
      <button disabled={submitting} className="w-full btn-primary-grad rounded-lg px-4 py-3 text-sm">
        {submitting ? "جاري الدخول..." : "دخول كأدمن"}
      </button>
      <p className="text-xs text-muted-foreground text-center">الافتراضي للماستر: <code className="text-primary">admin123</code></p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

// ============ WORKSHOP VIEW ============
function WorkshopView({ session, onLogout, onSessionUpdate }: {
  session: Extract<Session, { kind: "workshop" }>; onLogout: () => void;
  onSessionUpdate: (s: Session) => void;
}) {
  const qc = useQueryClient();
  const { data: fields = [] } = useFields();
  const extras = customFields(fields);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["wsReports", session.id],
    queryFn: () => getWorkshopReports(session.id, session.password),
  });

  const totals = useMemo(() => {
    const t: Record<string, number> = { received: 0, repaired: 0, delivered: 0 };
    for (const r of reports) {
      t.received += r.received; t.repaired += r.repaired; t.delivered += r.delivered;
      const ex = (r.extra ?? {}) as Record<string, number>;
      for (const f of extras) t[f.key] = (t[f.key] ?? 0) + Number(ex[f.key] ?? 0);
    }
    return t;
  }, [reports, extras]);

  const initialForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    received: "", repaired: "", delivered: "", notes: "",
    extra: Object.fromEntries(extras.map(f => [f.key, ""])) as Record<string, string>,
  });
  const [form, setForm] = useState(initialForm);
  useEffect(() => {
    setForm(f => ({
      ...f,
      extra: Object.fromEntries(extras.map(x => [x.key, f.extra[x.key] ?? ""])) as Record<string, string>,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras.map(f => f.key).join(",")]);

  const addMut = useMutation({
    mutationFn: () => addReport({
      workshopId: session.id, password: session.password,
      date: form.date,
      received: Number(form.received || 0),
      repaired: Number(form.repaired || 0),
      delivered: Number(form.delivered || 0),
      notes: form.notes,
      extra: Object.fromEntries(extras.map(f => [f.key, Number(form.extra[f.key] || 0)])),
    }),
    onSuccess: () => {
      toast.success("تم حفظ التقرير");
      setForm(initialForm());
      qc.invalidateQueries({ queryKey: ["wsReports", session.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ في الحفظ"),
  });

  const accentMap: Record<string, "primary" | "success" | "warning"> = { received: "primary", repaired: "success", delivered: "warning" };

  return (
    <div className="space-y-8">
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-muted-foreground">مرحباً بك في</p>
        <h2 className="text-3xl font-black gradient-text mt-1">{session.name}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {BUILTIN_KEYS.map(k => (
          <SummaryCard key={k} label={labelFor(fields, k, k)} value={totals[k] ?? 0} accent={accentMap[k]} />
        ))}
      </div>
      {extras.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map(f => <SummaryCard key={f.id} label={f.label} value={totals[f.key] ?? 0} accent="primary" />)}
        </div>
      )}

      <section className="glass rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4">إضافة تقرير جديد</h3>
        <form onSubmit={e => { e.preventDefault(); addMut.mutate(); }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="التاريخ">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
          {BUILTIN_KEYS.map(k => (
            <Field key={k} label={labelFor(fields, k, k)}>
              <input type="number" min={0} value={(form as any)[k]}
                onChange={e => setForm({ ...form, [k]: e.target.value } as any)}
                placeholder="0" className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
            </Field>
          ))}
          {extras.map(f => (
            <Field key={f.id} label={f.label}>
              <input type="number" min={0} value={form.extra[f.key] ?? ""}
                onChange={e => setForm({ ...form, extra: { ...form.extra, [f.key]: e.target.value } })}
                placeholder="0" className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
            </Field>
          ))}
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="ملاحظات (اختياري)">
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
            </Field>
          </div>
          <button disabled={addMut.isPending} className="btn-primary-grad rounded-lg px-4 py-3 text-sm sm:col-span-2 lg:col-span-1 lg:col-start-4">
            {addMut.isPending ? "جاري الحفظ..." : "حفظ التقرير"}
          </button>
        </form>
      </section>

      <section className="glass rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4">سجل التقارير</h3>
        {isLoading ? <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          : reports.length === 0 ? <p className="text-muted-foreground text-sm">لا توجد تقارير بعد.</p>
          : <ReportsTable reports={reports} fields={fields} />}
      </section>

      <ChangeWorkshopPassword session={session} onSessionUpdate={onSessionUpdate} />

      <button onClick={onLogout} className="text-sm text-muted-foreground hover:text-foreground">خروج →</button>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: "primary" | "success" | "warning" }) {
  const colorMap = {
    primary: "from-primary/30 to-primary/5 border-primary/40",
    success: "from-success/30 to-success/5 border-success/40",
    warning: "from-warning/30 to-warning/5 border-warning/40",
  };
  return (
    <div className={`rounded-2xl p-6 bg-gradient-to-br border ${colorMap[accent]}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-4xl font-black mt-2">{value.toLocaleString("ar-EG")}</p>
    </div>
  );
}

function ReportsTable({ reports, fields }: { reports: Report[]; fields: FieldConfig[] }) {
  const extras = customFields(fields);
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-muted-foreground border-b border-border">
            <th className="py-3 px-2">التاريخ</th>
            <th className="py-3 px-2">{labelFor(fields, "received", "الوارد")}</th>
            <th className="py-3 px-2">{labelFor(fields, "repaired", "تم تصليحه")}</th>
            <th className="py-3 px-2">{labelFor(fields, "delivered", "تم تسليمه")}</th>
            {extras.map(f => <th key={f.id} className="py-3 px-2">{f.label}</th>)}
            <th className="py-3 px-2">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30">
              <td className="py-3 px-2 whitespace-nowrap">{r.report_date}</td>
              <td className="py-3 px-2 font-semibold text-primary">{r.received}</td>
              <td className="py-3 px-2 font-semibold text-success">{r.repaired}</td>
              <td className="py-3 px-2 font-semibold text-warning">{r.delivered}</td>
              {extras.map(f => (
                <td key={f.id} className="py-3 px-2 font-semibold">{Number((r.extra as any)?.[f.key] ?? 0)}</td>
              ))}
              <td className="py-3 px-2 text-muted-foreground">{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ ADMIN VIEW ============
type AdminSession = Extract<Session, { kind: "admin" }>;

function hasPerm(s: AdminSession, p: PermissionKey) {
  return s.isMaster || s.permissions.includes(p);
}

function AdminView({ session }: { session: AdminSession }) {
  const tabs: Array<{ id: string; label: string; perm?: PermissionKey }> = [
    { id: "summary", label: "ملخص الورش", perm: "view_reports" },
    { id: "passwords", label: "كلمات مرور الورش", perm: "manage_workshop_passwords" },
    { id: "workshops", label: "إدارة الورش", perm: "manage_workshop_passwords" },
    { id: "fields", label: "الحقول", perm: "manage_settings" },
    { id: "admins", label: "الأدمنز الفرعيون", perm: "manage_settings" },
    { id: "settings", label: "الإعدادات", perm: "manage_settings" },
  ];
  const visibleTabs = tabs.filter(t => !t.perm || hasPerm(session, t.perm));
  const [tab, setTab] = useState<string>(visibleTabs[0]?.id ?? "summary");

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-muted-foreground">لوحة التحكم</p>
        <h2 className="text-3xl font-black gradient-text mt-1">
          {session.isMaster ? "أدمن رئيسي" : `أدمن: ${session.username}`}
        </h2>
        {!session.isMaster && (
          <p className="text-xs text-muted-foreground mt-2">
            الصلاحيات: {session.permissions.map(p => ALL_PERMISSIONS.find(x => x.key === p)?.label).join(" • ") || "لا صلاحيات"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-secondary/60">
        {visibleTabs.map(t => (
          <TabBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</TabBtn>
        ))}
      </div>

      {tab === "summary" && hasPerm(session, "view_reports") && <AdminSummaryTab session={session} />}
      {tab === "passwords" && hasPerm(session, "manage_workshop_passwords") && <AdminPasswordsTab password={session.password} />}
      {tab === "workshops" && hasPerm(session, "manage_workshop_passwords") && <AdminWorkshopsTab password={session.password} />}
      {tab === "fields" && hasPerm(session, "manage_settings") && <AdminFieldsTab password={session.password} />}
      {tab === "admins" && hasPerm(session, "manage_settings") && <AdminSubAdminsTab password={session.password} />}
      {tab === "settings" && hasPerm(session, "manage_settings") && <AdminSettingsTab session={session} />}
    </div>
  );
}

function AdminSummaryTab({ session }: { session: AdminSession }) {
  const password = session.password;
  const { data: fields = [] } = useFields();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["adminAll"], queryFn: () => adminGetAll(password),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  const grand = useMemo(() => rows.reduce(
    (a, r) => ({ received: a.received + Number(r.total_received), repaired: a.repaired + Number(r.total_repaired), delivered: a.delivered + Number(r.total_delivered) }),
    { received: 0, repaired: 0, delivered: 0 }
  ), [rows]);

  if (isLoading) return <p className="text-muted-foreground">جاري التحميل...</p>;

  async function handleExcel() {
    try { await exportAdminExcel(password, rows); toast.success("تم تصدير Excel"); }
    catch (e: any) { toast.error(e.message ?? "فشل التصدير"); }
  }
  async function handlePDF() {
    try { await exportAdminPDF(password, rows); }
    catch (e: any) { toast.error(e.message ?? "فشل التصدير"); }
  }
  async function handleDailyPDF() {
    try { await exportDailyPDF(password, dailyDate, rows, settings?.notification_email); }
    catch (e: any) { toast.error(e.message ?? "فشل التصدير"); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label={`إجمالي ${labelFor(fields, "received", "الوارد")}`} value={grand.received} accent="primary" />
        <SummaryCard label={`إجمالي ${labelFor(fields, "repaired", "تم تصليحه")}`} value={grand.repaired} accent="success" />
        <SummaryCard label={`إجمالي ${labelFor(fields, "delivered", "تم تسليمه")}`} value={grand.delivered} accent="warning" />
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <h3 className="font-bold">تصدير التقارير</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <button onClick={handleExcel} className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm">📊 تصدير Excel</button>
          <button onClick={handlePDF} className="rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-5 py-2.5 text-sm">📄 تصدير PDF شامل</button>
          <div className="h-8 w-px bg-border mx-1" />
          <Field label="تقرير يومي بتاريخ">
            <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
              className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm" />
          </Field>
          <button onClick={handleDailyPDF} className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm">
            📅 تصدير التقرير اليومي
          </button>
        </div>
        {settings?.notification_email && (
          <p className="text-xs text-muted-foreground">سيظهر زر «إرسال للبريد» داخل التقرير اليومي للإيميل: <code className="text-primary">{settings.notification_email}</code></p>
        )}
      </div>

      <div className="glass rounded-2xl p-2 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground border-b border-border">
                <th className="py-3 px-3">الورشة</th>
                <th className="py-3 px-3">{labelFor(fields, "received", "الوارد")}</th>
                <th className="py-3 px-3">{labelFor(fields, "repaired", "تم تصليحه")}</th>
                <th className="py-3 px-3">{labelFor(fields, "delivered", "تم تسليمه")}</th>
                <th className="py-3 px-3">عدد التقارير</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <RowWithDetails key={r.workshop_id} row={r} session={session} fields={fields}
                  open={openId === r.workshop_id} onToggle={() => setOpenId(openId === r.workshop_id ? null : r.workshop_id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RowWithDetails({ row, session, fields, open, onToggle }:
  { row: AdminSummary; session: AdminSession; fields: FieldConfig[]; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-secondary/30">
        <td className="py-3 px-3 font-semibold">{row.workshop_name}</td>
        <td className="py-3 px-3 text-primary font-bold">{Number(row.total_received).toLocaleString("ar-EG")}</td>
        <td className="py-3 px-3 text-success font-bold">{Number(row.total_repaired).toLocaleString("ar-EG")}</td>
        <td className="py-3 px-3 text-warning font-bold">{Number(row.total_delivered).toLocaleString("ar-EG")}</td>
        <td className="py-3 px-3">{Number(row.reports_count)}</td>
        <td className="py-3 px-3">
          <button onClick={onToggle} className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs hover:bg-secondary">
            {open ? "إخفاء" : "عرض التقارير"}
          </button>
        </td>
      </tr>
      {open && (
        <tr><td colSpan={6} className="bg-background/40 p-4">
          <WorkshopReportsAdmin session={session} workshopId={row.workshop_id} fields={fields} />
        </td></tr>
      )}
    </>
  );
}

function WorkshopReportsAdmin({ session, workshopId, fields }: { session: AdminSession; workshopId: string; fields: FieldConfig[] }) {
  const qc = useQueryClient();
  const extras = customFields(fields);
  const canEdit = hasPerm(session, "edit_reports");
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["adminReports", workshopId],
    queryFn: () => adminGetReports(session.password, workshopId),
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const delMut = useMutation({
    mutationFn: (reportId: string) => adminDeleteReport(session.password, reportId),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["adminReports", workshopId] });
      qc.invalidateQueries({ queryKey: ["adminAll"] });
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">جاري التحميل...</p>;
  if (reports.length === 0) return <p className="text-muted-foreground text-sm">لا توجد تقارير.</p>;

  return (
    <div className="space-y-2">
      {reports.map(r => editingId === r.id
        ? <EditReportForm key={r.id} report={r} adminPassword={session.password} workshopId={workshopId} fields={fields} onClose={() => setEditingId(null)} />
        : (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-card/60 border border-border/50 p-3 text-sm">
            <span className="text-muted-foreground">{r.report_date}</span>
            <span>{labelFor(fields, "received", "وارد")}: <b className="text-primary">{r.received}</b></span>
            <span>{labelFor(fields, "repaired", "تصليح")}: <b className="text-success">{r.repaired}</b></span>
            <span>{labelFor(fields, "delivered", "تسليم")}: <b className="text-warning">{r.delivered}</b></span>
            {extras.map(f => (
              <span key={f.id}>{f.label}: <b>{Number((r.extra as any)?.[f.key] ?? 0)}</b></span>
            ))}
            {r.notes && <span className="text-muted-foreground">— {r.notes}</span>}
            {canEdit && (
              <div className="ms-auto flex gap-2">
                <button onClick={() => setEditingId(r.id)} className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary">تعديل</button>
                <button onClick={() => { if (confirm("حذف هذا التقرير؟")) delMut.mutate(r.id); }}
                  className="rounded border border-destructive/50 text-destructive px-2 py-1 text-xs hover:bg-destructive/10">حذف</button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

function EditReportForm({ report, adminPassword, workshopId, fields, onClose }:
  { report: Report; adminPassword: string; workshopId: string; fields: FieldConfig[]; onClose: () => void }) {
  const qc = useQueryClient();
  const extras = customFields(fields);
  const [f, setF] = useState({
    date: report.report_date,
    received: String(report.received),
    repaired: String(report.repaired),
    delivered: String(report.delivered),
    notes: report.notes ?? "",
    extra: Object.fromEntries(extras.map(x => [x.key, String((report.extra as any)?.[x.key] ?? "")])) as Record<string, string>,
  });
  const mut = useMutation({
    mutationFn: () => adminUpdateReport({
      adminPassword, reportId: report.id, date: f.date,
      received: Number(f.received), repaired: Number(f.repaired), delivered: Number(f.delivered),
      notes: f.notes,
      extra: Object.fromEntries(extras.map(x => [x.key, Number(f.extra[x.key] || 0)])),
    }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["adminReports", workshopId] });
      qc.invalidateQueries({ queryKey: ["adminAll"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  return (
    <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="grid gap-2 sm:grid-cols-6 rounded-lg bg-card border border-primary/40 p-3 text-sm">
      <input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" />
      <input type="number" min={0} value={f.received} onChange={e => setF({ ...f, received: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" placeholder={labelFor(fields, "received", "وارد")} />
      <input type="number" min={0} value={f.repaired} onChange={e => setF({ ...f, repaired: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" placeholder={labelFor(fields, "repaired", "تصليح")} />
      <input type="number" min={0} value={f.delivered} onChange={e => setF({ ...f, delivered: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" placeholder={labelFor(fields, "delivered", "تسليم")} />
      <input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5 sm:col-span-2" placeholder="ملاحظات" />
      {extras.map(x => (
        <input key={x.id} type="number" min={0} value={f.extra[x.key] ?? ""}
          onChange={e => setF({ ...f, extra: { ...f.extra, [x.key]: e.target.value } })}
          placeholder={x.label} className="rounded bg-input border border-border px-2 py-1.5" />
      ))}
      <div className="sm:col-span-6 flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs">إلغاء</button>
        <button disabled={mut.isPending} className="btn-primary-grad rounded px-3 py-1.5 text-xs">{mut.isPending ? "..." : "حفظ"}</button>
      </div>
    </form>
  );
}

// ============ PASSWORDS TAB ============
function AdminPasswordsTab({ password }: { password: string }) {
  const { data: workshops = [] } = useQuery({ queryKey: ["workshops"], queryFn: listWorkshops });
  return (
    <div className="glass rounded-2xl p-6 space-y-3">
      <h3 className="text-lg font-bold mb-2">تعديل كلمات مرور الورش</h3>
      {workshops.map(w => <PasswordRow key={w.id} workshop={w} adminPassword={password} />)}
    </div>
  );
}

function PasswordRow({ workshop, adminPassword }: { workshop: Workshop; adminPassword: string }) {
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  const mut = useMutation({
    mutationFn: () => adminUpdateWorkshopPassword(adminPassword, workshop.id, val),
    onSuccess: () => { toast.success(`تم تحديث ${workshop.name}`); setVal(""); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  return (
    <form onSubmit={e => { e.preventDefault(); if (val.length < 3) return toast.error("3 أحرف على الأقل"); mut.mutate(); }}
      className="flex flex-wrap items-center gap-3 rounded-lg bg-card/60 border border-border/50 p-3">
      <span className="font-semibold flex-1 min-w-[12rem]">{workshop.name}</span>
      <input type={show ? "text" : "password"} value={val} onChange={e => setVal(e.target.value)}
        placeholder="كلمة مرور جديدة" className="rounded bg-input border border-border px-3 py-2 text-sm" />
      <button type="button" onClick={() => setShow(!show)} className="text-xs text-muted-foreground hover:text-foreground">{show ? "إخفاء" : "إظهار"}</button>
      <button disabled={mut.isPending || !val} className="btn-primary-grad rounded px-4 py-2 text-xs">{mut.isPending ? "..." : "حفظ"}</button>
    </form>
  );
}

// ============ WORKSHOPS MANAGEMENT TAB ============
function AdminWorkshopsTab({ password }: { password: string }) {
  const qc = useQueryClient();
  const { data: workshops = [], isLoading } = useQuery({ queryKey: ["workshops"], queryFn: listWorkshops });
  const [name, setName] = useState("");
  const [pw, setPw] = useState("1234");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["workshops"] });
    qc.invalidateQueries({ queryKey: ["adminAll"] });
  };
  const addMut = useMutation({
    mutationFn: () => adminAddWorkshop(password, name.trim(), pw),
    onSuccess: () => { toast.success("تمت الإضافة"); setName(""); setPw("1234"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminDeleteWorkshop(password, id),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 max-w-2xl">
        <h3 className="text-lg font-bold mb-3">إضافة ورشة جديدة</h3>
        <form onSubmit={e => {
          e.preventDefault();
          if (name.trim().length < 2) return toast.error("اكتب اسم الورشة");
          if (pw.length < 3) return toast.error("كلمة المرور قصيرة");
          addMut.mutate();
        }} className="grid gap-3 sm:grid-cols-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الورشة"
            className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm sm:col-span-1" />
          <input value={pw} onChange={e => setPw(e.target.value)} placeholder="كلمة المرور"
            className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm" />
          <button disabled={addMut.isPending} className="btn-primary-grad rounded-lg px-4 py-2.5 text-sm">
            {addMut.isPending ? "..." : "+ إضافة"}
          </button>
        </form>
      </div>

      <div className="glass rounded-2xl p-6 space-y-2">
        <h3 className="text-lg font-bold mb-2">الورش الحالية</h3>
        {isLoading ? <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          : workshops.map(w => (
            <div key={w.id} className="flex items-center gap-3 rounded-lg bg-card/60 border border-border/50 p-3">
              <span className="font-semibold flex-1">{w.name}</span>
              <button onClick={() => { if (confirm(`حذف ${w.name}؟ سيتم حذف كل تقاريرها.`)) delMut.mutate(w.id); }}
                className="rounded border border-destructive/50 text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10">
                حذف
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ============ FIELDS TAB ============
function AdminFieldsTab({ password }: { password: string }) {
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["adminFields"], queryFn: () => adminListFields(password),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["adminFields"] });
    qc.invalidateQueries({ queryKey: ["fields"] });
  };
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const addMut = useMutation({
    mutationFn: () => adminAddField(password, newKey.trim(), newLabel.trim()),
    onSuccess: () => { toast.success("تمت الإضافة"); setNewKey(""); setNewLabel(""); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-lg font-bold mb-2">تعديل أسماء الحقول</h3>
        <p className="text-xs text-muted-foreground mb-3">
          غيّر الاسم المعروض لأي حقل. الحقول الأساسية محمية من الحذف.
        </p>
        {isLoading ? <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          : fields.map(f => <FieldRow key={f.id} field={f} adminPassword={password} onChange={invalidate} />)}
      </div>

      <div className="glass rounded-2xl p-6 space-y-3 max-w-2xl">
        <h3 className="text-lg font-bold mb-2">إضافة حقل جديد</h3>
        <p className="text-xs text-muted-foreground">
          المفتاح بالإنجليزية بدون مسافات. الاسم المعروض بالعربية.
        </p>
        <form onSubmit={e => {
          e.preventDefault();
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newKey)) return toast.error("مفتاح غير صالح");
          if (newLabel.trim().length < 2) return toast.error("اكتب اسماً");
          addMut.mutate();
        }} className="grid gap-3 sm:grid-cols-3">
          <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="key (مثل tested)"
            className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm" />
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="الاسم المعروض"
            className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm" />
          <button disabled={addMut.isPending} className="btn-primary-grad rounded-lg px-4 py-2.5 text-sm">
            {addMut.isPending ? "..." : "+ إضافة حقل"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldRow({ field, adminPassword, onChange }: { field: FieldConfig; adminPassword: string; onChange: () => void }) {
  const [label, setLabel] = useState(field.label);
  const upd = useMutation({
    mutationFn: () => adminUpdateFieldLabel(adminPassword, field.id, label.trim()),
    onSuccess: () => { toast.success("تم التحديث"); onChange(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  const del = useMutation({
    mutationFn: () => adminDeleteField(adminPassword, field.id),
    onSuccess: () => { toast.success("تم الحذف"); onChange(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card/60 border border-border/50 p-3">
      <code className="text-xs text-muted-foreground min-w-[6rem]">{field.key}</code>
      {field.is_builtin && <span className="text-[10px] rounded bg-primary/20 text-primary px-2 py-0.5">أساسي</span>}
      <input value={label} onChange={e => setLabel(e.target.value)}
        className="rounded bg-input border border-border px-3 py-2 text-sm flex-1 min-w-[12rem]" />
      <button onClick={() => { if (label.trim().length < 2) return toast.error("الاسم قصير"); upd.mutate(); }}
        disabled={upd.isPending || label === field.label}
        className="btn-primary-grad rounded px-4 py-2 text-xs">{upd.isPending ? "..." : "حفظ"}</button>
      {!field.is_builtin && (
        <button onClick={() => { if (confirm(`حذف "${field.label}"؟`)) del.mutate(); }}
          className="rounded border border-destructive/50 text-destructive px-3 py-2 text-xs hover:bg-destructive/10">حذف</button>
      )}
    </div>
  );
}

// ============ SUB-ADMINS TAB ============
function AdminSubAdminsTab({ password }: { password: string }) {
  const qc = useQueryClient();
  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["adminUsers"], queryFn: () => adminListAdmins(password),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["adminUsers"] });

  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [perms, setPerms] = useState<PermissionKey[]>(["view_reports"]);

  const addMut = useMutation({
    mutationFn: () => adminAddAdmin(password, username.trim(), pw, perms),
    onSuccess: () => { toast.success("تم إنشاء الأدمن"); setUsername(""); setPw(""); setPerms(["view_reports"]); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 max-w-3xl space-y-3">
        <h3 className="text-lg font-bold">إضافة أدمن فرعي</h3>
        <form onSubmit={e => {
          e.preventDefault();
          if (username.trim().length < 2) return toast.error("اكتب اسم المستخدم");
          if (pw.length < 4) return toast.error("كلمة المرور قصيرة");
          if (perms.length === 0) return toast.error("اختر صلاحية واحدة على الأقل");
          addMut.mutate();
        }} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم"
              className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm" />
            <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="كلمة المرور"
              className="rounded-lg bg-input border border-border px-3 py-2.5 text-sm" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">الصلاحيات:</span>
            <div className="grid sm:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2 rounded-lg bg-card/60 border border-border/50 px-3 py-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={perms.includes(p.key)}
                    onChange={e => setPerms(e.target.checked ? [...perms, p.key] : perms.filter(x => x !== p.key))} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <button disabled={addMut.isPending} className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm">
            {addMut.isPending ? "..." : "+ إنشاء أدمن"}
          </button>
        </form>
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="text-lg font-bold">الأدمنز الحاليون</h3>
        {isLoading ? <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          : admins.length === 0 ? <p className="text-muted-foreground text-sm">لا يوجد أدمنز فرعيون.</p>
          : admins.map(a => <SubAdminRow key={a.id} admin={a} adminPassword={password} onChange={invalidate} />)}
      </div>
    </div>
  );
}

function SubAdminRow({ admin, adminPassword, onChange }: { admin: AdminUser; adminPassword: string; onChange: () => void }) {
  const [perms, setPerms] = useState<PermissionKey[]>(admin.permissions);
  const [newPw, setNewPw] = useState("");
  const upd = useMutation({
    mutationFn: () => adminUpdateAdmin(adminPassword, admin.id, newPw || null, perms),
    onSuccess: () => { toast.success("تم التحديث"); setNewPw(""); onChange(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  const del = useMutation({
    mutationFn: () => adminDeleteAdmin(adminPassword, admin.id),
    onSuccess: () => { toast.success("تم الحذف"); onChange(); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  return (
    <div className="rounded-lg bg-card/60 border border-border/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-bold flex-1 min-w-[8rem]">{admin.username}</span>
        <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="كلمة مرور جديدة (اختياري)"
          className="rounded bg-input border border-border px-3 py-2 text-sm" />
        <button onClick={() => upd.mutate()} disabled={upd.isPending}
          className="btn-primary-grad rounded px-4 py-2 text-xs">{upd.isPending ? "..." : "حفظ"}</button>
        <button onClick={() => { if (confirm(`حذف الأدمن ${admin.username}؟`)) del.mutate(); }}
          className="rounded border border-destructive/50 text-destructive px-3 py-2 text-xs hover:bg-destructive/10">حذف</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {ALL_PERMISSIONS.map(p => (
          <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={perms.includes(p.key)}
              onChange={e => setPerms(e.target.checked ? [...perms, p.key] : perms.filter(x => x !== p.key))} />
            {p.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ============ SETTINGS TAB ============
function AdminSettingsTab({ session }: { session: AdminSession }) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (settings) { setTheme(settings.theme); setEmail(settings.notification_email ?? ""); }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => adminUpdateSettings(session.password, theme, email),
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      applyTheme(theme);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  const [oldP, setOldP] = useState(session.password);
  const [newP, setNewP] = useState("");
  const pwMut = useMutation({
    mutationFn: () => adminUpdateMasterPassword(oldP, newP),
    onSuccess: () => { toast.success("تم تغيير كلمة المرور — سجّل دخول مجدداً"); setNewP(""); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 max-w-2xl space-y-4">
        <h3 className="text-lg font-bold">الإعدادات العامة</h3>

        <div className="space-y-2">
          <span className="text-sm font-medium">السمة (Theme)</span>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setTheme("dark"); applyTheme("dark"); }}
              className={`rounded-xl border-2 p-4 text-right transition ${theme === "dark" ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}>
              <div className="text-sm font-bold mb-1">🌙 داكن (الحالي)</div>
              <div className="text-xs text-muted-foreground">خلفية داكنة بألوان نيون</div>
            </button>
            <button type="button" onClick={() => { setTheme("light"); applyTheme("light"); }}
              className={`rounded-xl border-2 p-4 text-right transition ${theme === "light" ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}>
              <div className="text-sm font-bold mb-1">☀️ مودرن فاتح</div>
              <div className="text-xs text-muted-foreground">خلفية بيضاء عصرية</div>
            </button>
          </div>
        </div>

        <Field label="البريد الإلكتروني لاستقبال التقارير اليومية">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
        </Field>
        <p className="text-xs text-muted-foreground">
          عند تصدير التقرير اليومي، يظهر زر «إرسال للبريد» يفتح برنامج البريد لإرسال PDF لهذا الإيميل.
        </p>

        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm">
          {saveMut.isPending ? "..." : "حفظ الإعدادات"}
        </button>
      </div>

      {session.isMaster && (
        <div className="glass rounded-2xl p-6 max-w-lg space-y-4">
          <h3 className="text-lg font-bold">تغيير كلمة مرور الأدمن الرئيسي</h3>
          <Field label="كلمة المرور الحالية">
            <input type="password" value={oldP} onChange={e => setOldP(e.target.value)}
              className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
          <Field label="كلمة المرور الجديدة">
            <input type="password" value={newP} onChange={e => setNewP(e.target.value)}
              className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
          <button onClick={() => { if (newP.length < 4) return toast.error("4 أحرف على الأقل"); pwMut.mutate(); }}
            disabled={pwMut.isPending} className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm">
            {pwMut.isPending ? "..." : "تحديث"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ CHANGE WORKSHOP PASSWORD ============
function ChangeWorkshopPassword({ session, onSessionUpdate }: {
  session: Extract<Session, { kind: "workshop" }>; onSessionUpdate: (s: Session) => void;
}) {
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [newP2, setNewP2] = useState("");
  const mut = useMutation({
    mutationFn: () => workshopChangePassword(session.id, oldP, newP),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور");
      onSessionUpdate({ ...session, password: newP });
      setOldP(""); setNewP(""); setNewP2("");
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  return (
    <section className="glass rounded-2xl p-6 max-w-2xl">
      <h3 className="text-xl font-bold mb-4">🔑 تغيير كلمة المرور</h3>
      <form onSubmit={e => {
        e.preventDefault();
        if (newP.length < 3) return toast.error("كلمة المرور قصيرة (3 أحرف على الأقل)");
        if (newP !== newP2) return toast.error("كلمة المرور وتأكيدها غير متطابقين");
        mut.mutate();
      }} className="grid gap-3 sm:grid-cols-3">
        <Field label="كلمة المرور الحالية">
          <input type="password" value={oldP} onChange={e => setOldP(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
        </Field>
        <Field label="كلمة المرور الجديدة">
          <input type="password" value={newP} onChange={e => setNewP(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
        </Field>
        <Field label="تأكيد الجديدة">
          <input type="password" value={newP2} onChange={e => setNewP2(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
        </Field>
        <button disabled={mut.isPending || !oldP || !newP} className="btn-primary-grad rounded-lg px-4 py-2.5 text-sm sm:col-start-3">
          {mut.isPending ? "..." : "تحديث كلمة المرور"}
        </button>
      </form>
    </section>
  );
}

// ============ ADMIN IMPORT ============
function AdminImportSection({ password }: { password: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm(`استيراد التقارير من ${file.name}؟ سيتم إضافة الصفوف كتقارير جديدة.`)) return;
    setBusy(true);
    try {
      const res = await importAdminExcel(password, file);
      toast.success(`تم الاستيراد: ${res.imported} صف${res.skipped ? ` — تخطى ${res.skipped}` : ""}`);
      if (res.errors.length) {
        console.warn("Import errors:", res.errors);
        toast.message(`تنبيهات (${res.errors.length})`, { description: res.errors.slice(0, 3).join(" • ") });
      }
      qc.invalidateQueries({ queryKey: ["adminAll"] });
      qc.invalidateQueries({ queryKey: ["adminReports"] });
    } catch (err: any) {
      toast.error(err.message ?? "فشل الاستيراد");
    } finally { setBusy(false); }
  }
  return (
    <label className={`rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-5 py-2.5 text-sm cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      {busy ? "جاري الاستيراد..." : "📥 استيراد من Excel"}
      <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
    </label>
  );
}
