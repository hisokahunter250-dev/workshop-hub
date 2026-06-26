import * as XLSX from "xlsx";
import { adminGetReports, adminImportReport, listFields, listWorkshops, type AdminSummary, type Report, type FieldConfig } from "@/lib/api";

const arabicNum = (n: number) => Number(n).toLocaleString("ar-EG");

function labelOf(fields: FieldConfig[], key: string, fb: string) {
  return fields.find(f => f.key === key)?.label ?? fb;
}

export async function exportAdminExcel(adminPassword: string, rows: AdminSummary[]) {
  const fields = await listFields().catch(() => [] as FieldConfig[]);
  const extras = fields.filter(f => !f.is_builtin);
  const wb = XLSX.utils.book_new();

  const lblR = labelOf(fields, "received", "الوارد للصيانة");
  const lblF = labelOf(fields, "repaired", "تم تصليحه");
  const lblD = labelOf(fields, "delivered", "تم تسليمه للمركز");

  // Summary
  const head = ["الورشة", lblR, lblF, lblD, "عدد التقارير"];
  const summaryData: any[][] = [
    ["تقرير شامل لجميع الورش"],
    [`تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}`],
    [],
    head,
    ...rows.map(r => [
      r.workshop_name,
      Number(r.total_received),
      Number(r.total_repaired),
      Number(r.total_delivered),
      Number(r.reports_count),
    ]),
    [
      "الإجمالي",
      rows.reduce((s, r) => s + Number(r.total_received), 0),
      rows.reduce((s, r) => s + Number(r.total_repaired), 0),
      rows.reduce((s, r) => s + Number(r.total_delivered), 0),
      rows.reduce((s, r) => s + Number(r.reports_count), 0),
    ],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "الملخص");

  // Per workshop
  for (const row of rows) {
    const reports: Report[] = await adminGetReports(adminPassword, row.workshop_id);
    if (reports.length === 0) continue;
    const headerRow = ["التاريخ", lblR, lblF, lblD, ...extras.map(e => e.label), "ملاحظات"];
    const data = [
      [row.workshop_name],
      [],
      headerRow,
      ...reports.map(r => [
        r.report_date, r.received, r.repaired, r.delivered,
        ...extras.map(e => Number((r.extra as any)?.[e.key] ?? 0)),
        r.notes ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = headerRow.map(() => ({ wch: 14 }));
    const safe = row.workshop_name.replace(/[\\/\[\]\*\?:]/g, "").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }

  XLSX.writeFile(wb, `تقرير_الورش_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------- HTML PDF builder ----------
function buildPdfHtml(opts: {
  title: string;
  subtitle: string;
  fields: FieldConfig[];
  rows: AdminSummary[];
  details: Array<{ workshop: AdminSummary; reports: Report[] }>;
  autoPrint?: boolean;
  email?: string | null;
}) {
  const { fields, rows, details } = opts;
  const extras = fields.filter(f => !f.is_builtin);
  const lblR = labelOf(fields, "received", "الوارد");
  const lblF = labelOf(fields, "repaired", "تم تصليحه");
  const lblD = labelOf(fields, "delivered", "تم تسليمه");

  const totals = {
    received: rows.reduce((s, r) => s + Number(r.total_received), 0),
    repaired: rows.reduce((s, r) => s + Number(r.total_repaired), 0),
    delivered: rows.reduce((s, r) => s + Number(r.total_delivered), 0),
  };

  const detailHtml = details
    .filter(d => d.reports.length > 0)
    .map(d => `
      <h3>${d.workshop.workshop_name}</h3>
      <table>
        <thead><tr>
          <th>التاريخ</th><th>${lblR}</th><th>${lblF}</th><th>${lblD}</th>
          ${extras.map(e => `<th>${e.label}</th>`).join("")}
          <th>ملاحظات</th>
        </tr></thead>
        <tbody>
          ${d.reports.map(r => `
            <tr>
              <td>${r.report_date}</td>
              <td>${r.received}</td>
              <td>${r.repaired}</td>
              <td>${r.delivered}</td>
              ${extras.map(e => `<td>${Number((r.extra as any)?.[e.key] ?? 0)}</td>`).join("")}
              <td>${(r.notes ?? "").replace(/</g, "&lt;")}</td>
            </tr>`).join("")}
        </tbody>
      </table>`).join("");

  const mailBtn = opts.email
    ? `<a class="mail" href="mailto:${opts.email}?subject=${encodeURIComponent(opts.title)}&body=${encodeURIComponent("مرفق تقرير الورش — احفظ الصفحة كـ PDF وأرفقها بالبريد.")}">📧 إرسال للبريد ${opts.email}</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${opts.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap">
<style>
  *{box-sizing:border-box}
  body{font-family:'Cairo',Arial,sans-serif;padding:24px;color:#111}
  h1{text-align:center;color:#0a6f80;margin-bottom:4px}
  .meta{text-align:center;color:#555;margin-bottom:24px;font-size:13px}
  .summary-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .card{border:1px solid #ddd;border-radius:8px;padding:16px;text-align:center}
  .card .label{font-size:13px;color:#666}
  .card .value{font-size:28px;font-weight:900;margin-top:6px}
  table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:13px}
  th,td{border:1px solid #ccc;padding:8px;text-align:right}
  thead th{background:#0a6f80;color:#fff;font-weight:700}
  tbody tr:nth-child(even){background:#f5f9fa}
  h2{color:#0a6f80;border-bottom:2px solid #0a6f80;padding-bottom:6px;margin-top:32px}
  h3{color:#0a6f80;margin-top:24px}
  tfoot td{font-weight:700;background:#eef6f8}
  .actions{text-align:center;margin-bottom:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
  .actions button,.actions .mail{background:#0a6f80;color:#fff;border:0;padding:10px 24px;border-radius:6px;font-family:inherit;font-size:14px;cursor:pointer;text-decoration:none}
  @media print {.actions{display:none}body{padding:0}}
</style></head><body>
  <div class="actions">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
    ${mailBtn}
  </div>
  <h1>${opts.title}</h1>
  <div class="meta">${opts.subtitle}</div>
  <div class="summary-cards">
    <div class="card"><div class="label">إجمالي ${lblR}</div><div class="value">${arabicNum(totals.received)}</div></div>
    <div class="card"><div class="label">${lblF}</div><div class="value">${arabicNum(totals.repaired)}</div></div>
    <div class="card"><div class="label">${lblD}</div><div class="value">${arabicNum(totals.delivered)}</div></div>
  </div>
  <h2>ملخص الورش</h2>
  <table>
    <thead><tr>
      <th>الورشة</th><th>${lblR}</th><th>${lblF}</th><th>${lblD}</th><th>عدد التقارير</th>
    </tr></thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${r.workshop_name}</td>
        <td>${arabicNum(Number(r.total_received))}</td>
        <td>${arabicNum(Number(r.total_repaired))}</td>
        <td>${arabicNum(Number(r.total_delivered))}</td>
        <td>${arabicNum(Number(r.reports_count))}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot><tr>
      <td>الإجمالي</td>
      <td>${arabicNum(totals.received)}</td>
      <td>${arabicNum(totals.repaired)}</td>
      <td>${arabicNum(totals.delivered)}</td>
      <td>${arabicNum(rows.reduce((s, r) => s + Number(r.reports_count), 0))}</td>
    </tr></tfoot>
  </table>
  <h2>تفاصيل التقارير</h2>
  ${detailHtml || '<p style="text-align:center;color:#888">لا توجد تقارير.</p>'}
  ${opts.autoPrint ? `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),600));</script>` : ""}
</body></html>`;
}

function openHtml(html: string) {
  const win = window.open("", "_blank");
  if (!win) { alert("الرجاء السماح بالنوافذ المنبثقة"); return; }
  win.document.write(html);
  win.document.close();
}

export async function exportAdminPDF(adminPassword: string, rows: AdminSummary[]) {
  const fields = await listFields().catch(() => []);
  const details: Array<{ workshop: AdminSummary; reports: Report[] }> = [];
  for (const row of rows) {
    const reports = await adminGetReports(adminPassword, row.workshop_id);
    details.push({ workshop: row, reports });
  }
  openHtml(buildPdfHtml({
    title: "تقرير الورش - صيانة العدادات",
    subtitle: `تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}`,
    fields, rows, details, autoPrint: true,
  }));
}

// Daily PDF: filters reports to a specific date and aggregates totals
export async function exportDailyPDF(adminPassword: string, dateISO: string, allRows: AdminSummary[], email?: string | null) {
  const fields = await listFields().catch(() => []);
  const details: Array<{ workshop: AdminSummary; reports: Report[] }> = [];
  const aggregated: AdminSummary[] = [];

  for (const row of allRows) {
    const all = await adminGetReports(adminPassword, row.workshop_id);
    const dayReports = all.filter(r => r.report_date === dateISO);
    const totRec = dayReports.reduce((s, r) => s + r.received, 0);
    const totRep = dayReports.reduce((s, r) => s + r.repaired, 0);
    const totDel = dayReports.reduce((s, r) => s + r.delivered, 0);
    aggregated.push({
      workshop_id: row.workshop_id,
      workshop_name: row.workshop_name,
      sort_order: row.sort_order,
      total_received: totRec,
      total_repaired: totRep,
      total_delivered: totDel,
      reports_count: dayReports.length,
    });
    if (dayReports.length > 0) details.push({ workshop: row, reports: dayReports });
  }

  openHtml(buildPdfHtml({
    title: `تقرير يومي - ${dateISO}`,
    subtitle: `تاريخ التقرير: ${dateISO}${email ? ` — للإرسال إلى: ${email}` : ""}`,
    fields, rows: aggregated, details, autoPrint: true, email: email ?? null,
  }));
}
