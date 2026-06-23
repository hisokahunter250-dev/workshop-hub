import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listWorkshops, loginWorkshop, loginAdmin,
  getWorkshopReports, addReport,
  adminGetAll, adminGetReports, adminUpdateWorkshopPassword,
  adminUpdateMasterPassword, adminUpdateReport, adminDeleteReport,
  type Workshop, type Report, type AdminSummary,
} from "@/lib/api";
import { exportAdminExcel, exportAdminPDF } from "@/lib/export";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نظام تقارير الورش — صيانة العدادات" },
      { name: "description", content: "نظام إدارة تقارير صيانة العدادات للورش — ادخل ببيانات ورشتك أو كأدمن لعرض كل البيانات" },
    ],
  }),
  component: HomePage,
});

type Session =
  | { kind: "none" }
  | { kind: "workshop"; id: string; name: string; password: string }
  | { kind: "admin"; password: string };

const SESSION_KEY = "workshop_session_v1";

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

function HomePage() {
  const [session, setSession] = useState<Session>({ kind: "none" });
  useEffect(() => { setSession(loadSession()); }, []);

  function setAndSave(s: Session) { setSession(s); saveSession(s); }

  return (
    <div className="min-h-screen">
      <Header session={session} onLogout={() => setAndSave({ kind: "none" })} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        {session.kind === "none" && <LoginScreen onLogin={setAndSave} />}
        {session.kind === "workshop" && <WorkshopView session={session} onLogout={() => setAndSave({ kind: "none" })} />}
        {session.kind === "admin" && <AdminView password={session.password} />}
      </main>
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        نظام تقارير الورش © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function Header({ session, onLogout }: { session: Session; onLogout: () => void }) {
  return (
    <header className="border-b border-border/40 backdrop-blur-md sticky top-0 z-30" style={{ background: "oklch(0.16 0.025 250 / 0.7)" }}>
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
          كل ورشة تدخل ببياناتها وتسجل: العدد الوارد للصيانة، ما تم تصليحه، وما تم تسليمه للمركز.
          والأدمن يطلع على إحصائيات كل الورش ويتحكم بكلمات المرور والبيانات.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
          <Stat label="ورشة" value="16" />
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
      const ok = await loginAdmin(password);
      if (!ok) { toast.error("كلمة مرور الأدمن غير صحيحة"); return; }
      toast.success("أهلاً بك أيها المدير");
      onLogin({ kind: "admin", password });
    } catch (e: any) { toast.error(e.message ?? "خطأ"); }
    finally { setSubmitting(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="كلمة مرور الماستر">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••" className="w-full rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary" />
      </Field>
      <button disabled={submitting} className="w-full btn-primary-grad rounded-lg px-4 py-3 text-sm">
        {submitting ? "جاري الدخول..." : "دخول كأدمن"}
      </button>
      <p className="text-xs text-muted-foreground text-center">كلمة المرور الافتراضية: <code className="text-primary">admin123</code></p>
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
function WorkshopView({ session, onLogout }: {
  session: Extract<Session, { kind: "workshop" }>; onLogout: () => void;
}) {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["wsReports", session.id],
    queryFn: () => getWorkshopReports(session.id, session.password),
  });

  const totals = useMemo(() => reports.reduce(
    (a, r) => ({ received: a.received + r.received, repaired: a.repaired + r.repaired, delivered: a.delivered + r.delivered }),
    { received: 0, repaired: 0, delivered: 0 }
  ), [reports]);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    received: "", repaired: "", delivered: "", notes: "",
  });

  const addMut = useMutation({
    mutationFn: () => addReport({
      workshopId: session.id, password: session.password,
      date: form.date,
      received: Number(form.received || 0),
      repaired: Number(form.repaired || 0),
      delivered: Number(form.delivered || 0),
      notes: form.notes,
    }),
    onSuccess: () => {
      toast.success("تم حفظ التقرير");
      setForm({ date: new Date().toISOString().slice(0, 10), received: "", repaired: "", delivered: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["wsReports", session.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ في الحفظ"),
  });

  return (
    <div className="space-y-8">
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-muted-foreground">مرحباً بك في</p>
        <h2 className="text-3xl font-black gradient-text mt-1">{session.name}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="إجمالي الوارد" value={totals.received} accent="primary" />
        <SummaryCard label="تم تصليحه" value={totals.repaired} accent="success" />
        <SummaryCard label="تم تسليمه للمركز" value={totals.delivered} accent="warning" />
      </div>

      <section className="glass rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4">إضافة تقرير جديد</h3>
        <form onSubmit={e => { e.preventDefault(); addMut.mutate(); }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="التاريخ">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
          <Field label="عدد العدادات الواردة">
            <input type="number" min={0} value={form.received} onChange={e => setForm({ ...form, received: e.target.value })}
              placeholder="0" className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
          <Field label="عدد التي تم تصليحها">
            <input type="number" min={0} value={form.repaired} onChange={e => setForm({ ...form, repaired: e.target.value })}
              placeholder="0" className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
          <Field label="عدد التي تم تسليمها">
            <input type="number" min={0} value={form.delivered} onChange={e => setForm({ ...form, delivered: e.target.value })}
              placeholder="0" className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
          </Field>
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
          : reports.length === 0 ? <p className="text-muted-foreground text-sm">لا توجد تقارير بعد. ابدأ بإضافة تقرير جديد.</p>
          : <ReportsTable reports={reports} />}
      </section>

      <button onClick={onLogout} className="text-sm text-muted-foreground hover:text-foreground">خروج من حساب الورشة →</button>
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

function ReportsTable({ reports }: { reports: Report[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-muted-foreground border-b border-border">
            <th className="py-3 px-2">التاريخ</th>
            <th className="py-3 px-2">الوارد</th>
            <th className="py-3 px-2">تم تصليحه</th>
            <th className="py-3 px-2">تم تسليمه</th>
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
              <td className="py-3 px-2 text-muted-foreground">{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ ADMIN VIEW ============
function AdminView({ password }: { password: string }) {
  const [tab, setTab] = useState<"summary" | "passwords" | "settings">("summary");
  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-muted-foreground">لوحة التحكم</p>
        <h2 className="text-3xl font-black gradient-text mt-1">واجهة الأدمن</h2>
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-secondary/60 max-w-xl">
        <TabBtn active={tab === "summary"} onClick={() => setTab("summary")}>ملخص الورش</TabBtn>
        <TabBtn active={tab === "passwords"} onClick={() => setTab("passwords")}>كلمات المرور</TabBtn>
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>إعدادات الأدمن</TabBtn>
      </div>

      {tab === "summary" && <AdminSummaryTab password={password} />}
      {tab === "passwords" && <AdminPasswordsTab password={password} />}
      {tab === "settings" && <AdminSettingsTab password={password} />}
    </div>
  );
}

function AdminSummaryTab({ password }: { password: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["adminAll"], queryFn: () => adminGetAll(password),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const grand = useMemo(() => rows.reduce(
    (a, r) => ({ received: a.received + Number(r.total_received), repaired: a.repaired + Number(r.total_repaired), delivered: a.delivered + Number(r.total_delivered) }),
    { received: 0, repaired: 0, delivered: 0 }
  ), [rows]);

  if (isLoading) return <p className="text-muted-foreground">جاري التحميل...</p>;

  async function handleExcel() {
    try { await exportAdminExcel(password, rows); toast.success("تم تصدير ملف Excel"); }
    catch (e: any) { toast.error(e.message ?? "فشل التصدير"); }
  }
  async function handlePDF() {
    try { await exportAdminPDF(password, rows); }
    catch (e: any) { toast.error(e.message ?? "فشل التصدير"); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="إجمالي الوارد لكل الورش" value={grand.received} accent="primary" />
        <SummaryCard label="إجمالي تم تصليحه" value={grand.repaired} accent="success" />
        <SummaryCard label="إجمالي تم تسليمه" value={grand.delivered} accent="warning" />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleExcel} className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm inline-flex items-center gap-2">
          📊 تصدير Excel
        </button>
        <button onClick={handlePDF} className="rounded-lg border border-border bg-secondary/60 hover:bg-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2">
          📄 تصدير PDF / طباعة
        </button>
      </div>

      <div className="glass rounded-2xl p-2 sm:p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground border-b border-border">
                <th className="py-3 px-3">الورشة</th>
                <th className="py-3 px-3">الوارد</th>
                <th className="py-3 px-3">تم تصليحه</th>
                <th className="py-3 px-3">تم تسليمه</th>
                <th className="py-3 px-3">عدد التقارير</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <RowWithDetails key={r.workshop_id} row={r} adminPassword={password}
                  open={openId === r.workshop_id} onToggle={() => setOpenId(openId === r.workshop_id ? null : r.workshop_id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RowWithDetails({ row, adminPassword, open, onToggle }:
  { row: AdminSummary; adminPassword: string; open: boolean; onToggle: () => void }) {
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
            {open ? "إخفاء التفاصيل" : "عرض التقارير"}
          </button>
        </td>
      </tr>
      {open && (
        <tr><td colSpan={6} className="bg-background/40 p-4">
          <WorkshopReportsAdmin adminPassword={adminPassword} workshopId={row.workshop_id} />
        </td></tr>
      )}
    </>
  );
}

function WorkshopReportsAdmin({ adminPassword, workshopId }: { adminPassword: string; workshopId: string }) {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["adminReports", workshopId],
    queryFn: () => adminGetReports(adminPassword, workshopId),
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const delMut = useMutation({
    mutationFn: (reportId: string) => adminDeleteReport(adminPassword, reportId),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["adminReports", workshopId] });
      qc.invalidateQueries({ queryKey: ["adminAll"] });
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">جاري التحميل...</p>;
  if (reports.length === 0) return <p className="text-muted-foreground text-sm">لا توجد تقارير لهذه الورشة.</p>;

  return (
    <div className="space-y-2">
      {reports.map(r => editingId === r.id
        ? <EditReportForm key={r.id} report={r} adminPassword={adminPassword} workshopId={workshopId} onClose={() => setEditingId(null)} />
        : (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-card/60 border border-border/50 p-3 text-sm">
            <span className="text-muted-foreground">{r.report_date}</span>
            <span>وارد: <b className="text-primary">{r.received}</b></span>
            <span>تصليح: <b className="text-success">{r.repaired}</b></span>
            <span>تسليم: <b className="text-warning">{r.delivered}</b></span>
            {r.notes && <span className="text-muted-foreground">— {r.notes}</span>}
            <div className="ms-auto flex gap-2">
              <button onClick={() => setEditingId(r.id)} className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary">تعديل</button>
              <button onClick={() => { if (confirm("حذف هذا التقرير؟")) delMut.mutate(r.id); }}
                className="rounded border border-destructive/50 text-destructive px-2 py-1 text-xs hover:bg-destructive/10">حذف</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function EditReportForm({ report, adminPassword, workshopId, onClose }:
  { report: Report; adminPassword: string; workshopId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    date: report.report_date, received: String(report.received),
    repaired: String(report.repaired), delivered: String(report.delivered),
    notes: report.notes ?? "",
  });
  const mut = useMutation({
    mutationFn: () => adminUpdateReport({
      adminPassword, reportId: report.id, date: f.date,
      received: Number(f.received), repaired: Number(f.repaired), delivered: Number(f.delivered), notes: f.notes,
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
      <input type="number" min={0} value={f.received} onChange={e => setF({ ...f, received: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" placeholder="وارد" />
      <input type="number" min={0} value={f.repaired} onChange={e => setF({ ...f, repaired: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" placeholder="تصليح" />
      <input type="number" min={0} value={f.delivered} onChange={e => setF({ ...f, delivered: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5" placeholder="تسليم" />
      <input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="rounded bg-input border border-border px-2 py-1.5 sm:col-span-2" placeholder="ملاحظات" />
      <div className="sm:col-span-6 flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs">إلغاء</button>
        <button disabled={mut.isPending} className="btn-primary-grad rounded px-3 py-1.5 text-xs">{mut.isPending ? "..." : "حفظ"}</button>
      </div>
    </form>
  );
}

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
    onSuccess: () => { toast.success(`تم تحديث كلمة مرور ${workshop.name}`); setVal(""); },
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

function AdminSettingsTab({ password }: { password: string }) {
  const [oldP, setOldP] = useState(password);
  const [newP, setNewP] = useState("");
  const mut = useMutation({
    mutationFn: () => adminUpdateMasterPassword(oldP, newP),
    onSuccess: () => { toast.success("تم تغيير كلمة مرور الأدمن — سجّل خروج وادخل مجدداً"); setNewP(""); },
    onError: (e: any) => toast.error(e.message ?? "خطأ"),
  });
  return (
    <div className="glass rounded-2xl p-6 max-w-lg space-y-4">
      <h3 className="text-lg font-bold">تغيير كلمة مرور الأدمن</h3>
      <Field label="كلمة المرور الحالية">
        <input type="password" value={oldP} onChange={e => setOldP(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
      </Field>
      <Field label="كلمة المرور الجديدة">
        <input type="password" value={newP} onChange={e => setNewP(e.target.value)}
          className="w-full rounded-lg bg-input border border-border px-3 py-2.5" />
      </Field>
      <button onClick={() => { if (newP.length < 4) return toast.error("4 أحرف على الأقل"); mut.mutate(); }}
        disabled={mut.isPending} className="btn-primary-grad rounded-lg px-5 py-2.5 text-sm">
        {mut.isPending ? "..." : "تحديث كلمة المرور"}
      </button>
    </div>
  );
}
