import { jsPDF } from "jspdf";
import type { AuditRecord } from "~/types/audit";

export type ReportType = "full" | "executive" | "compliance";
export interface CompanyConfig {
  company_name?: string; company_address?: string; company_phone?: string; company_email?: string;
  audit_report_header?: string; audit_report_footer?: string; include_disclaimer?: boolean; disclaimer_text?: string; logo_url?: string;
}

type Check = { id: string; text: string; category: string };
const checks: Check[] = [
  ["entry-points", "Entry Points & Perimeter", ["Exterior doors have commercial-grade deadbolts","Door frames are solid and free from damage","Strike plates secured with 3-inch screws","Hinges have non-removable pins","Doors close and latch properly (≤1/8\" gap)","Glass within 40\" of lock is reinforced","Sliding doors have anti-lift devices","Garage doors secure","Loading dock doors have heavy-duty locks"]],
  ["locks-hardware", "Locks & Hardware", ["Cylinders show no wear/tampering","Locks operate smoothly","Deadbolts have ≥1\" throw","Latch bolts fully engage strike","Panic bars/exit devices function (≤15 lbs force)","Door closers operate at proper speed (5+ seconds)","No fluid leaks from closers","All hardware screws present and tight","Key control system is documented","Master key hierarchy is documented"]],
  ["access-control", "Access Control & Electronic Systems", ["Electronic locks have functional batteries","Access control logs are recording","Access permissions reviewed regularly","Emergency override procedures documented","Alarm system tested monthly","CCTV coverage adequate","Keypad codes changed regularly"]],
  ["key-management", "Key Management", ["Key inventory audited regularly","Key holder authorization documented","Lost/missing keys tracked","Keys recovered when employees leave","Restricted keyways used for master systems","Digital codes rotated after staff changes","Contractor access logged"]],
  ["compliance-safety", "Compliance & Safety", ["Fire-rated doors have intact labels (UL/ANSI)","Emergency exits unobstructed","Panic hardware ≤15 lbs force","ADA opening force ≤5 lbs","ADA handles are lever-type","ADA clear width ≥32 inches","Threshold height meets ADA standards","Fire extinguishers accessible and current"]],
  ["environmental", "Environmental & Structural", ["Door frames are plumb and aligned","No signs of forced entry/tampering","Weatherstripping intact","Thresholds secure and undamaged","Lighting covers all entry points","Landscaping does not obscure entry points"]],
].flatMap(([category, name, items]) => (items as string[]).map((text, i) => ({ id: `${category}-${i + 1}`, text, category: name })));

export async function generateAuditReport(audit: AuditRecord, reportType: ReportType, config: CompanyConfig): Promise<Blob> {
  const doc = new jsPDF();
  const margin = 18; const pageHeight = doc.internal.pageSize.getHeight(); const pageWidth = doc.internal.pageSize.getWidth();
  const result = (id: string) => audit.results.find((r) => r.checkpointId === id);
  const selected = checks.filter((c) => reportType === "compliance" ? c.category === "Compliance & Safety" : reportType === "executive" ? ["fail", "attention"].includes(result(c.id)?.status ?? "") : true);
  const counts = { pass: audit.results.filter((r) => r.status === "pass").length, fail: audit.results.filter((r) => r.status === "fail").length, attention: audit.results.filter((r) => r.status === "attention").length };
  let y = 25;
  const footer = () => { doc.setFontSize(8); doc.setTextColor(100); doc.text(config.audit_report_footer ?? "Confidential - For authorized personnel only", margin, pageHeight - 10); doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin - 18, pageHeight - 10); };
  const page = () => { if (y > pageHeight - 30) { footer(); doc.addPage(); y = 22; } };
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(config.company_name ?? "Your Locksmith Company", margin, y); y += 18;
  doc.setFontSize(18); doc.text(config.audit_report_header ?? "Security Audit Report", margin, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.text(`Client: ${audit.clientName}`, margin, y); y += 8; doc.text(`Address: ${audit.address}`, margin, y); y += 8; doc.text(`Date: ${audit.date}`, margin, y); y += 8; doc.text(`Type: ${audit.auditType}`, margin, y); y += 25;
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Summary", margin, y); y += 10; doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.text(`Pass: ${counts.pass}    Fail: ${counts.fail}    Attention: ${counts.attention}`, margin, y); y += 20;
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(reportType === "full" ? "Checklist" : reportType === "executive" ? "Priority Findings" : "Compliance Checklist", margin, y); y += 12;
  let category = "";
  for (const check of selected) { page(); if (category !== check.category) { category = check.category; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(40); doc.text(category, margin, y); y += 8; } const status = result(check.id)?.status ?? "unchecked"; const symbol = status === "pass" ? "✓" : status === "fail" ? "✕" : status === "attention" ? "△" : "–"; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(status === "pass" ? 22 : status === "fail" ? 190 : status === "attention" ? 170 : 100); doc.text(symbol, margin, y); doc.setTextColor(35); doc.text(check.text, margin + 8, y); y += 7; }
  if (config.include_disclaimer && config.disclaimer_text) { page(); y += 10; doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(90); const lines = doc.splitTextToSize(config.disclaimer_text, pageWidth - margin * 2); doc.text(lines, margin, y); }
  footer(); return doc.output("blob");
}

export function downloadReport(blob: Blob, filename: string): void { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
