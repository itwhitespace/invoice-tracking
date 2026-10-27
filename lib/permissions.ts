// Per-user permission keys. The same strings are checked by the database
// (supabase/access-control-2-enforce.sql), so renaming one here means
// renaming it there too.
export type PermissionKey =
  | "export_excel"
  | "create_proposal"
  | "edit_project"
  | "edit_payment"
  | "edit_total_fee"
  | "approve"
  | "edit_target"
  | "delete_project"
  | "issue_documents";

export const PERMISSIONS: { key: PermissionKey; label: string; hint: string }[] = [
  { key: "export_excel", label: "Export Excel", hint: "ปุ่ม Export รายงานบนหน้า Dashboard" },
  { key: "create_proposal", label: "Upload / เพิ่ม Proposal", hint: "หน้า Upload Proposal และปุ่มเพิ่ม Proposal" },
  { key: "edit_project", label: "แก้ไขรายละเอียดโครงการ", hint: "ชื่อ, Timeframe, งวดเงิน, Start Date, แผนก, แสดง/ซ่อนใน Roadmap" },
  { key: "edit_payment", label: "เปลี่ยนสถานะจ่ายเงิน / ย้ายสัปดาห์", hint: "บนหน้า Project Roadmap รวมถึงเขียน Note" },
  { key: "edit_total_fee", label: "แก้ Total Fee", hint: "ไอคอนดินสอในหน้าต่างรายละเอียด" },
  { key: "approve", label: "Approve / ยกเลิกการอนุมัติ", hint: "แท็บรายละเอียดการดำเนินงาน" },
  { key: "delete_project", label: "ลบโครงการ", hint: "ปุ่มลบในหน้า Proposal Preview" },
  { key: "edit_target", label: "แก้ Target", hint: "ตาราง Annual Billing บนหน้า Dashboard" },
  { key: "issue_documents", label: "ออกใบแจ้งหนี้", hint: "เมนูใบแจ้งหนี้ รวมถึงแก้ข้อมูลบริษัทและรายชื่อลูกค้า" },
];

export type TemplateKey = "admin" | "editor" | "viewer";

// Templates only pre-fill the checkboxes when an Admin sets someone up —
// editing a template later does not change users who already used it.
export const PERMISSION_TEMPLATES: { key: TemplateKey; label: string; isAdmin: boolean; permissions: PermissionKey[] }[] = [
  { key: "admin", label: "Admin (ผู้ดูแลระบบ)", isAdmin: true, permissions: PERMISSIONS.map((p) => p.key) },
  {
    key: "editor",
    label: "Editor (ผู้แก้ไขข้อมูล)",
    isAdmin: false,
    permissions: [
      "export_excel",
      "create_proposal",
      "edit_project",
      "edit_payment",
      "edit_total_fee",
      "approve",
      "delete_project",
    ],
  },
  { key: "viewer", label: "Viewer (ผู้ดูข้อมูล)", isAdmin: false, permissions: ["export_excel"] },
];

export interface AppUser {
  email: string;
  display_name: string | null;
  companies: string[];
  permissions: PermissionKey[];
  is_admin: boolean;
  template: TemplateKey | null;
  signature_path?: string | null;
  created_at?: string;
}

// Which template a user's current ticks match exactly, if any — shown as
// "Editor" vs "Editor (ปรับเอง)" in the user list.
export function matchTemplate(user: Pick<AppUser, "is_admin" | "permissions">): TemplateKey | null {
  if (user.is_admin) return "admin";
  const mine = [...user.permissions].sort().join(",");
  const found = PERMISSION_TEMPLATES.find((t) => !t.isAdmin && [...t.permissions].sort().join(",") === mine);
  return found ? found.key : null;
}

export function describeUserLevel(user: Pick<AppUser, "is_admin" | "permissions" | "template">): string {
  const matched = matchTemplate(user);
  const tpl = PERMISSION_TEMPLATES.find((t) => t.key === (matched || user.template));
  const name = tpl ? tpl.label.split(" ")[0] : "กำหนดเอง";
  return matched ? name : `${name} (ปรับเอง)`;
}
