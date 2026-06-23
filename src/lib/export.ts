import * as XLSX from "xlsx";
import { adminGetReports, type AdminSummary, type Report } from "@/lib/api";

const arabicNum = (n: number) => Number(n).toLocaleString("ar-EG");

export async function exportAdminExcel(adminPassword: string, rows: AdminSummary[]) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["تقرير شامل لجميع الورش", "", "", "", ""],
    [`تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}`, "", "", "", ""],
    [],
    ["الورشة", "الوارد للصيانة", "تم تصليحه", "تم تسليمه للمركز", "عدد التقارير"],
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
  if (!summarySheet["!props"]) summarySheet["!props"] = {};
  XLSX.utils.book_append_sheet(wb, summarySheet, "الملخص");

  // Per-workshop sheets
  for (const row of rows) {
    const reports: Report[] = await adminGetReports(adminPassword, row.workshop_id);
    if (reports.length === 0) continue;
    const data = [
      [row.workshop_name],
      [],
      ["التاريخ", "الوارد", "تم تصليحه", "تم تسليمه", "ملاحظات"],
      ...reports.map(r => [r.report_date, r.received, r.repaired, r.delivered, r.notes ?? ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];
    // Sheet name max 31 chars and no special chars
    const safe = row.workshop_name.replace(/[\\\/\[\]\*\?\:]/g, "").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }

  XLSX.writeFile(wb, `تقرير_الورش_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportAdminPDF(adminPassword: string, rows: AdminSummary[]) {
  // Fetch all reports for detailed view
  const allDetails: Array<{ workshop: AdminSummary; reports: Report[] }> = [];
  for (const row of rows) {
    const reports = await adminGetReports(adminPassword, row.workshop_id);
    allDetails.push({ workshop: row, reports });
  }

  const totals = {
    received: rows.reduce((s, r) => s + Number(r.total_received), 0),
    repaired: rows.reduce((s, r) => s + Number(r.total_repaired), 0),
    delivered: rows.reduce((s, r) => s + Number(r.total_delivered), 0),
  };

  const today = new Date().toLocaleDateString("ar-EG");

  const detailHtml = allDetails
    .filter(d => d.reports.length > 0)
    .map(d => `
      <h3>${d.workshop.workshop_name}</h3>
      <table>
        <thead>
          <tr><th>التاريخ</th><th>الوارد</th><th>تم تصليحه</th><th>تم تسليمه</th><th>ملاحظات</th></tr>
        </thead>
        <tbody>
          ${d.reports.map(r => `
            <tr>
              <td>${r.report_date}</td>
              <td>${r.received}</td>
              <td>${r.repaired}</td>
              <td>${r.delivered}</td>
              <td>${(r.notes ?? "").replace(/</g, "&lt;")}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    `).join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير الورش - ${today}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', Arial, sans-serif; padding: 24px; color: #111; }
  h1 { text-align: center; color: #0a6f80; margin-bottom: 4px; }
  .meta { text-align: center; color: #555; margin-bottom: 24px; font-size: 13px; }
  .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; text-align: center; }
  .card .label { font-size: 13px; color: #666; }
  .card .value { font-size: 28px; font-weight: 900; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
  thead th { background: #0a6f80; color: white; font-weight: 700; }
  tbody tr:nth-child(even) { background: #f5f9fa; }
  h2 { color: #0a6f80; border-bottom: 2px solid #0a6f80; padding-bottom: 6px; margin-top: 32px; }
  h3 { color: #0a6f80; margin-top: 24px; }
  tfoot td { font-weight: 700; background: #eef6f8; }
  .actions { text-align: center; margin-bottom: 16px; }
  .actions button { background: #0a6f80; color: white; border: 0; padding: 10px 24px; border-radius: 6px; font-family: inherit; font-size: 14px; cursor: pointer; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
  </div>
  <h1>تقرير الورش - صيانة العدادات</h1>
  <div class="meta">تاريخ الإصدار: ${today}</div>

  <div class="summary-cards">
    <div class="card"><div class="label">إجمالي الوارد</div><div class="value">${arabicNum(totals.received)}</div></div>
    <div class="card"><div class="label">تم تصليحه</div><div class="value">${arabicNum(totals.repaired)}</div></div>
    <div class="card"><div class="label">تم تسليمه للمركز</div><div class="value">${arabicNum(totals.delivered)}</div></div>
  </div>

  <h2>ملخص الورش</h2>
  <table>
    <thead>
      <tr><th>الورشة</th><th>الوارد</th><th>تم تصليحه</th><th>تم تسليمه</th><th>عدد التقارير</th></tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${r.workshop_name}</td>
          <td>${arabicNum(Number(r.total_received))}</td>
          <td>${arabicNum(Number(r.total_repaired))}</td>
          <td>${arabicNum(Number(r.total_delivered))}</td>
          <td>${arabicNum(Number(r.reports_count))}</td>
        </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td>الإجمالي</td>
        <td>${arabicNum(totals.received)}</td>
        <td>${arabicNum(totals.repaired)}</td>
        <td>${arabicNum(totals.delivered)}</td>
        <td>${arabicNum(rows.reduce((s, r) => s + Number(r.reports_count), 0))}</td>
      </tr>
    </tfoot>
  </table>

  <h2>تفاصيل التقارير لكل ورشة</h2>
  ${detailHtml || '<p style="text-align:center;color:#888">لا توجد تقارير مسجلة بعد.</p>'}

  <script>
    window.addEventListener('load', () => setTimeout(() => window.print(), 600));
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("الرجاء السماح بفتح النوافذ المنبثقة لعرض التقرير");
    return;
  }
  win.document.write(html);
  win.document.close();
}
