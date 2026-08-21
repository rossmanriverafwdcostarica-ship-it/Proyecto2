export function reportOrderValue(report) {
  const timestamp = new Date(report?.fechaReporte || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function compareReportsNewestFirst(a, b) {
  const byDate = reportOrderValue(b) - reportOrderValue(a);
  if (byDate !== 0) return byDate;

  const aId = Number(a?.id);
  const bId = Number(b?.id);
  if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;

  return String(b?.id || '').localeCompare(String(a?.id || ''));
}

export function latestReportForCompany(reportes, companyId) {
  return reportes
    .filter(report => String(report.empresaId) === String(companyId))
    .sort(compareReportsNewestFirst)[0] || null;
}
