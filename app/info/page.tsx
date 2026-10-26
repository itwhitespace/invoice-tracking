import { Info as InfoIcon } from "lucide-react";
import { DEPARTMENT_OPTIONS, formatDepartmentLabel, getDepartmentAbbreviation, getDepartmentBadgeClasses } from "@/lib/department-utils";
import { COMPANY_DEPARTMENTS } from "@/lib/company-utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/payment-status-utils";
import { PERMISSIONS, PERMISSION_TEMPLATES } from "@/lib/permissions";

// Project-status badge colors — kept in sync with app/proposal-preview/page.tsx's
// own STATUS_STYLES (not imported since that one is local to a client component).
const PROJECT_STATUS_STYLES: Record<string, { label: string; classes: string; desc: string }> = {
  pending: { label: "Pending", classes: "bg-amber-100 text-amber-800 border-amber-300", desc: "รอตรวจสอบ ยังไม่ผ่านการยืนยันข้อมูล" },
  draft: { label: "Draft", classes: "bg-slate-100 text-slate-700 border-slate-300", desc: "ฉบับร่าง ยังแก้ไขได้อิสระ" },
  verified: { label: "Verified", classes: "bg-orange-100 text-orange-800 border-orange-300", desc: "ตรวจสอบข้อมูลแล้ว รอการอนุมัติขั้นสุดท้าย" },
  approved: { label: "Approved", classes: "bg-emerald-100 text-emerald-800 border-emerald-300", desc: "อนุมัติแล้ว — ไปแสดงที่หน้า Project Roadmap ทันที" },
};

// Payment-status badge colors, matching the hues used by the marker legend
// on Project Roadmap (PAYMENT_MARKER_STYLES) but in a lighter badge form.
const PAYMENT_STATUS_STYLES: Record<string, { classes: string; desc: string }> = {
  wait: { classes: "bg-amber-100 text-amber-800 border-amber-300", desc: "ตั้งวันที่คาดว่าจะวางบิล/เก็บเงินไว้แล้ว แต่ยังไม่ดำเนินการ" },
  invoice: { classes: "bg-sky-100 text-sky-800 border-sky-300", desc: "ออกใบแจ้งหนี้ไปแล้ว รอรับชำระ" },
  paid: { classes: "bg-emerald-100 text-emerald-800 border-emerald-300", desc: "ได้รับชำระเรียบร้อย" },
  hold: { classes: "bg-violet-100 text-violet-800 border-violet-300", desc: "ระงับชั่วคราว ยังไม่ยกเลิก — ไม่นับรวมในยอดรวมทุกจุด จนกว่าจะเปลี่ยนกลับเป็นสถานะอื่น" },
  cancelled: { classes: "bg-red-100 text-red-800 border-red-300", desc: "ยกเลิกงวดนี้ถาวร — ไม่นับรวมในยอดรวมทุกจุดอีกต่อไป" },
};

const TOC = [
  { href: "#overview", label: "ภาพรวมระบบ" },
  { href: "#status-project", label: "สถานะโครงการ" },
  { href: "#status-payment", label: "สถานะการจ่ายเงิน" },
  { href: "#calc-duration", label: "ระยะเวลาโครงการ" },
  { href: "#calc-payment", label: "% กับจำนวนเงิน" },
  { href: "#calc-fiscal", label: "ปีงบประมาณ & ปฏิทิน Roadmap" },
  { href: "#calc-dashboard", label: "สูตร Dashboard" },
  { href: "#departments", label: "บริษัทและแผนก" },
  { href: "#fields", label: "ช่องข้อมูล แก้ไขได้/ไม่ได้" },
  { href: "#pages", label: "ทัวร์แต่ละหน้า" },
  { href: "#export", label: "Export Excel" },
  { href: "#history", label: "ประวัติการแก้ไข" },
  { href: "#mobile", label: "การใช้งานบนมือถือ" },
  { href: "#access", label: "การเข้าสู่ระบบและสิทธิ์" },
  { href: "#invoices", label: "ใบแจ้งหนี้" },
  { href: "#notes", label: "ข้อควรรู้เพิ่มเติม" },
];

function SectionHeading({ num, title, desc }: { num: string; title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-semibold text-emerald-600">{num}</span>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
      </div>
      {desc && <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">{desc}</p>}
    </div>
  );
}

function Formula({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 text-slate-100 rounded-lg px-4 py-3 text-[11.5px] font-mono leading-relaxed overflow-x-auto">
      <div className="text-slate-400 text-[10px] uppercase tracking-wider font-sans font-semibold mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-2xs p-5 ${className}`}>
      {children}
    </div>
  );
}

export default function InfoPage() {
  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-12 md:h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <InfoIcon className="w-4 h-4 text-slate-700" />
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">คู่มือการใช้งานโปรแกรม</h1>
        <span className="hidden md:inline text-[11px] text-slate-400 ml-2">สถานะ สูตรคำนวณ และกติกาการใช้งาน</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-8 flex gap-8 items-start">
          {/* In-page quick nav */}
          <nav className="hidden lg:block w-48 shrink-0 sticky top-8 space-y-0.5">
            {TOC.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="block px-2.5 py-1.5 rounded-md text-[11.5px] text-slate-500 hover:text-slate-900 hover:bg-white transition truncate"
              >
                {t.label}
              </a>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-10 pb-16">
            <section id="overview" className="scroll-mt-6">
              <SectionHeading
                num="01"
                title="ภาพรวมระบบ"
                desc="ระบบติดตามโครงการและใบเสนอราคา (Proposal) ของ Whitespace Partners และ Whitespaceconnect ตั้งแต่สร้างโครงการ ตรวจสอบ อนุมัติ ไปจนถึงติดตามการเก็บเงินและสรุปยอดรายเดือน/รายปี"
              />
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["Dashboard", "สรุปยอดรายเดือนตามแผนก และเทียบเป้าหมาย (Target) รายปีงบประมาณของทั้งสองบริษัท"],
                      ["Project Roadmap", "มุมมอง Gantt รายสัปดาห์ของโครงการที่ Approved แล้ว ลากปรับกำหนดเก็บเงินได้"],
                      ["Proposal Preview", "รายการโครงการทั้งหมด ดูรายละเอียด แก้ไข อนุมัติ/ยกเลิกอนุมัติ"],
                      ["Upload Proposal", "นำเข้าโครงการใหม่จากไฟล์ PDF ให้ AI ช่วยดึงข้อมูล"],
                      ["ผู้ใช้งาน", "เพิ่มผู้ใช้ กำหนดบริษัทที่เห็นและสิทธิ์รายคน และดูว่าแต่ละคนเข้าใช้ล่าสุดเมื่อไหร่ (เฉพาะผู้ดูแลระบบ)"],
                      ["ใบแจ้งหนี้", "ออกและพิมพ์ใบแจ้งหนี้ จัดการข้อมูลบริษัทและรายชื่อลูกค้า (เฉพาะผู้มีสิทธิ์)"],
                      ["Settings", "เลือกรุ่น AI ที่ใช้ดึงข้อมูลจาก PDF (เฉพาะผู้ดูแลระบบ)"],
                    ].map(([name, desc], i) => (
                      <tr key={name} className={i !== 0 ? "border-t border-slate-100" : ""}>
                        <td className="font-mono font-semibold text-slate-800 px-5 py-3 w-44 align-top">{name}</td>
                        <td className="text-slate-600 px-5 py-3 align-top">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>

            <section id="status-project" className="scroll-mt-6">
              <SectionHeading
                num="02"
                title="สถานะโครงการ (Project Status)"
                desc="โครงการหนึ่งมีสถานะเดียวที่เวลาใดเวลาหนึ่งเสมอ ไล่ตามลำดับงานตั้งแต่สร้างจนอนุมัติ — ย้อนกลับได้เฉพาะจาก Approved กลับไป Verified"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.values(PROJECT_STATUS_STYLES).map((s) => (
                  <Card key={s.label} className="!p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.classes}`}>
                      {s.label}
                    </span>
                    <p className="text-[11.5px] text-slate-500 mt-2.5 leading-relaxed">{s.desc}</p>
                  </Card>
                ))}
              </div>
              <p className="text-[11.5px] text-slate-500 mt-3">
                โครงการที่สร้างผ่านหน้า <span className="font-mono">เพิ่ม Proposal</span> หรือ Upload จะเริ่มต้นที่สถานะ{" "}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border bg-orange-100 text-orange-800 border-orange-300">
                  Verified
                </span>{" "}
                เสมอ
              </p>
              <div className="grid md:grid-cols-2 gap-3 mt-4">
                <Formula label='กด Approve (หน้าต่างรายละเอียด > แท็บรายละเอียดการดำเนินงาน)'>
                  status → <span className="text-emerald-400">&quot;approved&quot;</span>, approvedAt → เวลาปัจจุบัน
                  <br />บันทึกทันที ไม่ต้องกดปุ่มบันทึกซ้ำ
                </Formula>
                <Formula label="กด Not Approved (ยกเลิกอนุมัติ — มีเฉพาะตอนสถานะเป็น Approved)">
                  status → <span className="text-emerald-400">&quot;verified&quot;</span>, approvedAt → ล้างค่า
                  <br />โครงการหลุดจาก Project Roadmap ทันที
                </Formula>
              </div>
            </section>

            <section id="status-payment" className="scroll-mt-6">
              <SectionHeading
                num="03"
                title="สถานะการจ่ายเงิน (Payment Status)"
                desc="เป็นสถานะของแต่ละงวดการชำระเงิน (Payment Term) ไม่ใช่สถานะของทั้งโครงการ — ปรับได้จากหน้า Project Roadmap เท่านั้น (คลิกกล่องสีในตาราง Gantt) หน้าต่างรายละเอียด Proposal แสดงเป็นป้ายอ่านอย่างเดียว"
              />
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {(Object.keys(PAYMENT_STATUS_LABELS) as (keyof typeof PAYMENT_STATUS_LABELS)[]).map((key, i) => (
                      <tr key={key} className={i !== 0 ? "border-t border-slate-100" : ""}>
                        <td className="px-5 py-3 w-48 align-top">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${PAYMENT_STATUS_STYLES[key].classes}`}>
                            {PAYMENT_STATUS_LABELS[key]}
                          </span>
                        </td>
                        <td className="text-slate-600 px-5 py-3 align-top">{PAYMENT_STATUS_STYLES[key].desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-[11.5px] text-slate-700 leading-relaxed">
                <b className="text-amber-700">กติกาพิเศษ:</b> เมื่อตั้งงวดใดงวดหนึ่งเป็น <span className="font-mono">ยกเลิกงาน</span> ทุกงวดที่อยู่{" "}
                <b>หลังจากงวดนั้น</b> (ตามลำดับในตาราง) จะถูกตั้งเป็นยกเลิกตามไปด้วยอัตโนมัติ — ย้อนกลับต้องแก้ทีละงวดเอง ระบบไม่มี &quot;สถานะก่อนหน้า&quot; ให้คืนค่าอัตโนมัติ
              </div>
            </section>

            <section id="calc-duration" className="scroll-mt-6">
              <SectionHeading
                num="04"
                title="สูตรคำนวณ — ระยะเวลาโครงการ"
                desc="ตาราง Project Timeframes คือแหล่งข้อมูลจริงของระยะเวลาเสมอ ไม่ใช่ตัวเลขที่เคยพิมพ์ไว้ตอนสร้างโครงการ"
              />
              <div className="space-y-3">
                <Formula label="แปลงข้อความระยะเวลา → จำนวนสัปดาห์ (ต่อ 1 Phase)">
                  &quot;3 Weeks&quot; → <span className="text-emerald-400">3</span>
                  &nbsp;&nbsp;·&nbsp;&nbsp;&quot;4&quot; (ตัวเลขเปล่า) → <span className="text-emerald-400">4</span> (นับเป็นสัปดาห์)
                  &nbsp;&nbsp;·&nbsp;&nbsp;&quot;1 Month&quot; → <span className="text-emerald-400">4</span> (1 เดือน = 4 สัปดาห์)
                  &nbsp;&nbsp;·&nbsp;&nbsp;&quot;10 Days&quot; → <span className="text-emerald-400">round(10 ÷ 7)</span> = 1
                  <br />&quot;2-3 Weeks&quot; → ใช้ตัวเลขที่ติดกับหน่วย = <span className="text-emerald-400">3</span>
                  &nbsp;&nbsp;·&nbsp;&nbsp;&quot;0&quot; หรือช่องว่าง → <span className="text-emerald-400">0</span>
                  &nbsp;&nbsp;·&nbsp;&nbsp;ค่าที่มากกว่า 0 แต่ปัดแล้วได้ 0 (เช่น 2 Days) → ขั้นต่ำ 1 สัปดาห์
                </Formula>
                <Formula label="ระยะเวลารวมของโครงการ (ที่แสดงทุกจุดในระบบ)">
                  รวมจำนวนสัปดาห์ของ <span className="text-emerald-400">ทุก Phase</span> ในตาราง Project Timeframes บวกกัน
                  <br />ถ้าตาราง Timeframes ว่างเปล่า (ไม่มี Phase เลย) ถึงจะย้อนกลับไปใช้ข้อความเดิมที่เคยบันทึกไว้ตอนสร้าง — ถ้าไม่มีเลยแสดง <span className="text-emerald-400">&quot;-&quot;</span>
                </Formula>
                <Formula label="Total Design Duration ในหน้า Upload Proposal">
                  ไม่ต้องกรอกเอง — คำนวณ <span className="text-emerald-400">อัตโนมัติ</span> จากผลรวมคอลัมน์ Duration (Week) ของตาราง Time Frame
                  <br />ตอนกด Save to Database จะบันทึกค่านี้เป็นข้อความ เช่น <span className="text-emerald-400">&quot;8 Weeks&quot;</span>
                </Formula>
              </div>
            </section>

            <section id="calc-payment" className="scroll-mt-6">
              <SectionHeading num="05" title="สูตรคำนวณ — % กับจำนวนเงินงวด" desc="ช่อง % และจำนวนเงิน (THB) ผูกกันสองทาง แก้ช่องไหนอีกช่องคำนวณตามให้อัตโนมัติ — ใช้เหมือนกันทั้งหน้า Upload Proposal, เพิ่ม Proposal และหน้าต่างรายละเอียด" />
              <div className="grid md:grid-cols-2 gap-3">
                <Formula label="แก้ % → คำนวณจำนวนเงิน">
                  จำนวนเงิน = <span className="text-emerald-400">round( Total Fee × % ÷ 100 )</span>
                </Formula>
                <Formula label="แก้จำนวนเงิน → คำนวณ %">
                  % = <span className="text-emerald-400">( จำนวนเงิน ÷ Total Fee ) × 100</span>
                </Formula>
              </div>
              <div className="mt-3">
                <Formula label="หลัง AI Extract (หน้า Upload Proposal)">
                  จำนวนเงินทุกงวด = <span className="text-emerald-400">round( Total Fee × % ÷ 100 )</span> — คำนวณใหม่เสมอ ไม่ใช้ยอดเงินจาก PDF ตรงๆ
                  <br />เพราะตาราง Payment ใน PDF มักเป็นยอด<b>รวม VAT 7%</b> แล้ว (เช่น 107,000) แต่ Total Fee คือยอด<b>ก่อน VAT</b>
                  <br />ถ้า PDF ไม่มี % เลย: % = สัดส่วนยอดเงินงวดนั้น ÷ ผลรวมยอดทุกงวดใน PDF × 100 แล้วค่อยคำนวณจำนวนเงินจาก Total Fee
                </Formula>
              </div>
              <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-lg text-[11.5px] text-slate-700 leading-relaxed">
                <b className="text-red-700">เพดานงบประมาณ:</b> ถ้าผลรวมจำนวนเงินทุกงวด &gt; Total Fee ระบบจะขึ้นแถบแดงเตือน และ{" "}
                <b>ปิดปุ่มบันทึก/สร้างโครงการ</b> จนกว่าจะปรับยอดให้ไม่เกิน (เงื่อนไขนี้ใช้เฉพาะตอน Total Fee มากกว่า 0 เท่านั้น)
              </div>
            </section>

            <section id="calc-fiscal" className="scroll-mt-6">
              <SectionHeading num="06" title="สูตรคำนวณ — ปีงบประมาณ & ปฏิทิน Roadmap" />
              <div className="space-y-3">
                <Formula label="ปีงบประมาณ">
                  เริ่มเดือน <span className="text-emerald-400">ตุลาคม</span> จบเดือน <span className="text-emerald-400">กันยายน</span> ปีถัดไป —
                  เรียกชื่อรอบตาม &quot;ปีเริ่มต้น&quot; เช่น รอบปี <span className="text-emerald-400">2568</span> หมายถึง ต.ค. 2568 – ก.ย. 2569
                </Formula>
                <Formula label="ตารางสัปดาห์บน Project Roadmap (เพื่อให้ตารางอ่านง่าย)">
                  แต่ละเดือนถูกแบ่งเป็น <span className="text-emerald-400">4 สัปดาห์</span> ยกเว้น <b>มกราคม กรกฎาคม ตุลาคม</b> ที่มี{" "}
                  <span className="text-emerald-400">5 สัปดาห์</span> — เป็นการจำลองเพื่อให้ตารางอ่านง่าย ไม่ใช่จำนวนวันจริงของเดือนนั้นๆ
                </Formula>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-3 leading-relaxed max-w-2xl">
                ตำแหน่งแท่ง &quot;Stage All&quot; บนผังงานคำนวณจาก Start Date + ผลรวมสัปดาห์ในตาราง Timeframes เท่านั้น ส่วนช่วงเวลาที่ตารางทั้งหน้าแสดง
                (auto-fit) จะขยายกว้างกว่านั้นได้อีก ถ้ามีงวดจ่ายเงินที่ตั้งสัปดาห์ไว้ไกลกว่าแท่งงาน
              </p>
            </section>

            <section id="calc-dashboard" className="scroll-mt-6">
              <SectionHeading num="07" title="สูตรคำนวณ — หน้า Dashboard" />
              <div className="grid md:grid-cols-2 gap-3">
                <Formula label="ตาราง Summary รายเดือน">
                  หน่วย <span className="text-emerald-400">K THB</span> (พันบาท) — รวมเฉพาะโครงการสถานะ Approved <b>ไม่นับงวดที่ Hold หรือยกเลิกงาน</b>
                </Formula>
                <Formula label="ตาราง Annual Billing">
                  หน่วย <span className="text-emerald-400">M THB</span> (ล้านบาท) — ขอบเขต 1 ปีงบประมาณที่เลือกดูอยู่
                </Formula>
              </div>
              <div className="mt-3">
                <Formula label="% Complete ต่อแผนก (และแถว Total)">
                  % Complete = <span className="text-emerald-400">Actual ÷ Target × 100</span> (ถ้า Target = 0 แสดง &quot;-&quot;)
                  <br />Actual = ผลรวมยอดเงินของงวดที่ตกอยู่ในปีงบประมาณนั้น จากโครงการ Approved ทุกตัวในแผนกนั้น (ไม่รวมงวดที่ Hold หรือยกเลิกงาน)
                  <br />ใช้กติกาเดียวกันกับแถวยอดรวมรายเดือนบน Project Roadmap และไฟล์ Export Excel
                </Formula>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-3">ปุ่มเลื่อนรอบงบประมาณ (◀/▶) จะกดต่อไม่ได้เมื่อถึงขอบเขตปีที่มีข้อมูลจริง — กันเลื่อนไปเจอปีว่างเปล่า</p>
            </section>

            <section id="departments" className="scroll-mt-6">
              <SectionHeading num="08" title="บริษัทและแผนก" desc="แต่ละบริษัทมีชุดแผนกของตัวเอง ตายตัว ไม่ปะปนกัน" />
              <div className="grid md:grid-cols-2 gap-3">
                {Object.entries(COMPANY_DEPARTMENTS).map(([company, depts]) => (
                  <Card key={company}>
                    <h4 className="text-[11.5px] font-semibold text-slate-500 mb-2.5">{company}</h4>
                    <div className="flex flex-wrap gap-2">
                      {depts.map((d) => (
                        <span key={d} className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getDepartmentBadgeClasses(d)}`}>
                          {formatDepartmentLabel(d)}
                          <span className="ml-1.5 font-mono font-normal opacity-70">{getDepartmentAbbreviation(d)}</span>
                        </span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
              <p className="text-[11.5px] text-slate-500 mt-3">
                สีของแต่ละแผนก ({DEPARTMENT_OPTIONS.length} แผนกทั้งหมด) ตรงกับกรอบตัวย่อที่เห็นในหน้า Project Roadmap — ใช้แยกแผนกด้วยตาได้เร็วขึ้นโดยไม่ต้องอ่านตัวหนังสือ
                ตัวอักษรเล็กหลังชื่อคือตัวย่อที่ใช้บน Roadmap และในไฟล์ Excel
              </p>
              <p className="text-[11.5px] text-slate-500 mt-2">
                แผนกของ WSCN เปลี่ยนชื่อเมื่อ ต.ค. 2569: Signage → Panda, Branding → Panther, Digital Mkt → Penguin — ข้อมูลเดิมที่บันทึกด้วยชื่อเก่าถูกอ่านเป็นชื่อใหม่ให้อัตโนมัติ
              </p>
            </section>

            <section id="fields" className="scroll-mt-6">
              <SectionHeading num="09" title="ช่องข้อมูลไหนแก้ไขได้ / ไม่ได้" desc="เฉพาะในหน้าต่างรายละเอียดของโครงการที่สร้างไว้แล้ว (ไม่ใช่ตอนสร้างใหม่ ซึ่งแก้ได้ทุกช่อง)" />
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["ชื่อโครงการ", <>แก้ไขได้ <span className="font-mono text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 ml-1">inline</span></>],
                      ["บริษัทผู้ออกเอกสาร", <>แก้ไข<b>ไม่ได้</b>หลังสร้างแล้ว — กำหนดได้ตอนสร้างโครงการเท่านั้น</>],
                      ["Total Fee", <>แก้ไขได้ ผ่านไอคอนดินสอ → กรอกค่าใหม่ → ยืนยัน Yes/No → ค่อยกดบันทึกอีกครั้งที่ปุ่มหลัก</>],
                      ["Project Timeframes", <>แก้ไขได้ทั้ง Phase / รายละเอียด / จำนวนสัปดาห์ เพิ่ม-ลบแถวได้</>],
                      ["Payment Terms", <>แก้ไขได้ทั้ง Milestone / % / จำนวนเงิน / สัปดาห์ที่เก็บ เพิ่ม-ลบแถวได้</>],
                      ["สถานะจ่ายเงิน", <>แก้ไข<b>ไม่ได้</b>ในหน้าต่างนี้ — ไปปรับที่หน้า Project Roadmap แทน</>],
                      ["Start Date / แผนก", <>แก้ไขได้ (แท็บรายละเอียดการดำเนินงาน)</>],
                      ["แสดงใน Roadmap", <>เปิด/ปิดได้ (เฉพาะโครงการ Approved) — ปิดแล้วยอดเงินยังถูกนับใน Dashboard/Export ตามปกติ แค่ไม่โชว์แถวบนตาราง Roadmap</>],
                    ].map(([name, desc], i) => (
                      <tr key={name as string} className={i !== 0 ? "border-t border-slate-100" : ""}>
                        <td className="font-mono text-[11px] font-semibold text-emerald-700 px-5 py-3 w-48 align-top whitespace-nowrap">{name}</td>
                        <td className="text-slate-600 px-5 py-3 align-top leading-relaxed">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>

            <section id="pages" className="scroll-mt-6">
              <SectionHeading num="10" title="ทัวร์แต่ละหน้า" />
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { name: "Dashboard", path: "/dashboard", items: ["ตาราง Summary รายเดือน + ตาราง Annual Billing แยกตามบริษัท", "แก้ไข Target รายแผนกได้ (ไอคอนดินสอ)", "ปุ่ม Export รายงานรอบงบประมาณเป็น Excel"] },
                  { name: "Project Roadmap", path: "/project-roadmap", items: ["Gantt รายสัปดาห์ ของโครงการ Approved เท่านั้น", "ลากกล่องสีย้ายสัปดาห์เก็บเงินได้ คลิกเพื่อเปลี่ยนสถานะจ่ายเงิน", "Tab กรองแผนก + ค้นหาด้วยชื่อโครงการ", "เรียงรายชื่อโครงการตามตัวอักษร A-Z เสมอ", "ปุ่ม Present Mode: แสดงตารางเต็มจอสำหรับประชุม (ซ่อนเมนูและหัวหน้า เหลือแถบ Filter บรรทัดเดียว) ย่อ/ขยายตารางได้ 50–150% ระบบจำค่าไว้ต่อเครื่อง กด Esc เพื่อออก"] },
                  { name: "Proposal Preview", path: "/proposal-preview", items: ["ตารางโครงการทั้งหมด เรียง A-Z ตามชื่อโครงการ", "Tab กรองแผนก + ปุ่ม Verified (โชว์เฉพาะตอนมีโครงการสถานะนี้จริง)", "ค้นหาด้วยชื่อโครงการ ลบ/ดู PDF/เปิดดูรายละเอียดได้จากตารางเดียว"] },
                  { name: "Upload Proposal", path: "/upload-proposal", items: ["อัปโหลดไฟล์ PDF ให้ AI ดึงชื่อโครงการ ระยะเวลา และเงื่อนไขจ่ายเงินให้อัตโนมัติ", "ตรวจทานก่อนบันทึกได้ก่อนเข้าสู่สถานะ Verified", "ตาราง Time Frame กรอกเฉพาะตัวเลขในคอลัมน์ Duration (Week) — Total Design Duration รวมให้อัตโนมัติ", "ต้องเลือก \"เก็บเงินสัปดาห์ที่\" ให้ครบทุกงวดก่อน Save (ตัวเลือกมีตาม Week รวมของ Time Frame)", "AI ใช้ Gemini 3.6 Flash → 3.7 Flash → Flash-Lite ตามลำดับ ถ้าตัวแรกไม่ว่างจะลองซ้ำ/สลับให้เอง ถ้าทุกตัวไม่ว่างจะขึ้นข้อความให้รอ 1-2 นาทีแล้วลองใหม่"] },
                ].map((p) => (
                  <Card key={p.name}>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-bold text-slate-900">{p.name}</h4>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{p.path}</span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-[11.5px] text-slate-500 leading-relaxed">
                      {p.items.map((it) => (
                        <li key={it} className="flex gap-2">
                          <span className="text-emerald-600 shrink-0">—</span>
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </section>

            <section id="export" className="scroll-mt-6">
              <SectionHeading
                num="11"
                title="Export Excel — รายงานรอบงบประมาณ"
                desc="กดจากหน้า Dashboard เท่านั้น ได้ไฟล์ขอบเขต 1 ปีงบประมาณที่กำลังดูอยู่ ชื่อไฟล์ขึ้นต้นด้วย Budget-Report-"
              />
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="font-mono font-semibold text-slate-800 px-5 py-3 w-40 align-top">Summary</td>
                      <td className="text-slate-600 px-5 py-3 align-top leading-relaxed">
                        ตารางยอดรายเดือนของทั้งสองบริษัท เรียงต่อกัน ตามด้วยตาราง Annual Billing ของทั้งสองบริษัท
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="font-mono font-semibold text-slate-800 px-5 py-3 align-top">1 ชีตต่อ 1 แผนก</td>
                      <td className="text-slate-600 px-5 py-3 align-top leading-relaxed">
                        ผังงาน Gantt แบบเดียวกับหน้า Project Roadmap — <b>รวมโครงการที่ปิดการแสดงผล (Hidden) ด้วย</b> ต่างจากบนหน้าจอที่ซ่อนแถวนั้นไว้
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </section>

            <section id="history" className="scroll-mt-6">
              <SectionHeading
                num="12"
                title='ประวัติการแก้ไข (แท็บ "ประวัติ")'
                desc="บันทึกเฉพาะการเปลี่ยนแปลงที่เกี่ยวกับเงินหรือสถานะ — ไม่ใช่ทุกการแก้ไข เพื่อไม่ให้ประวัติรกเกินไป"
              />
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["อนุมัติ / ยกเลิกอนุมัติ", "“อนุมัติโครงการ”"],
                      ["แก้ไข Total Fee", "“เปลี่ยน Total Fee จาก ฿X เป็น ฿Y”"],
                      ["แก้ไขจำนวนเงินงวด", "“เปลี่ยนจำนวนเงินงวด … จาก ฿X เป็น ฿Y”"],
                      ["ย้ายสัปดาห์เก็บเงิน", "“ย้ายกำหนดเก็บเงินงวด … จาก Week X เป็น Week Y”"],
                      ["เปลี่ยนสถานะจ่ายเงิน", "“เปลี่ยนสถานะงวด … จาก A เป็น B”"],
                    ].map(([name, ex], i) => (
                      <tr key={name} className={i !== 0 ? "border-t border-slate-100" : ""}>
                        <td className="text-slate-700 font-medium px-5 py-3 w-56 align-top">{name}</td>
                        <td className="text-slate-400 font-mono text-[11px] px-5 py-3 align-top">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <p className="text-[11.5px] text-slate-500 mt-3">
                <b className="text-slate-700">ไม่บันทึก:</b> การแก้ชื่อโครงการ แผนก Start Date หรือการเพิ่ม/ลบแถว Timeframe และ Payment Term
              </p>
            </section>

            <section id="mobile" className="scroll-mt-6">
              <SectionHeading
                num="13"
                title="การใช้งานบนมือถือ"
                desc="บนจอที่แคบกว่า 768px (โทรศัพท์) ระบบเปลี่ยนเป็นโหมดดูข้อมูลอย่างเดียว — การแก้ไขทุกอย่างต้องทำบนคอมพิวเตอร์"
              />
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["เมนู", "ซ่อน Sidebar — กดปุ่ม ☰ มุมซ้ายบนเพื่อเปิดเมนู"],
                      ["Dashboard", "ดูตาราง Summary / Annual Billing ได้ เลื่อนปีงบประมาณได้ ไม่มีปุ่ม Export Excel"],
                      ["Proposal Preview", "แสดงเป็นการ์ดทีละโครงการ แตะเพื่อดูรายละเอียดเต็มจอ (อ่านอย่างเดียว) และเปิดไฟล์ PDF ได้ — ไม่มีปุ่มเพิ่ม/ลบ/แก้ไข"],
                      ["Project Roadmap", "แสดงเป็นรายการตามโครงการแทน Gantt: ทุกงวดบอก Week, วันที่, %, ยอดเงิน และป้ายสถานะ — เปลี่ยนสถานะหรือลากย้ายสัปดาห์ไม่ได้"],
                      ["Upload Proposal / Settings / ผู้ใช้งาน", "ใช้งานไม่ได้ ขึ้นข้อความ \"กรุณาใช้งานบนคอมพิวเตอร์\""],
                    ].map(([name, desc], i) => (
                      <tr key={name} className={i !== 0 ? "border-t border-slate-100" : ""}>
                        <td className="font-mono font-semibold text-slate-800 px-5 py-3 w-44 align-top">{name}</td>
                        <td className="text-slate-600 px-5 py-3 align-top leading-relaxed">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <p className="text-[11.5px] text-slate-500 mt-3 leading-relaxed max-w-2xl">
                วันที่ของแต่ละงวดบนมือถือ: ใช้วันที่ของสถานะปัจจุบัน (วันนัดเก็บเงิน / วันวางบิล / วันเก็บเงินได้) ถ้ายังไม่มี จะแสดงวันที่ตามแผน = Start Date + (Week − 1) × 7 วัน
              </p>
            </section>

            <section id="access" className="scroll-mt-6">
              <SectionHeading
                num="14"
                title="การเข้าสู่ระบบและสิทธิ์"
                desc="เข้าระบบด้วยอีเมลที่ผู้ดูแลระบบเพิ่มไว้เท่านั้น ครั้งแรก (หรือตอนลืมรหัสผ่าน) ระบบส่งรหัส 6 หลักไปที่อีเมลเพื่อยืนยันตัวตน แล้วให้ตั้งรหัสผ่านเอง (อย่างน้อย 8 ตัว) ครั้งต่อไปเข้าด้วยอีเมล + รหัสผ่าน ระบบจำการเข้าไว้จนกว่าจะกดออกจากระบบ เปลี่ยนรหัสผ่านได้ที่เมนูด้านล่างซ้าย"
              />
              <div className="space-y-3">
                <Card>
                  <h4 className="text-[12px] font-bold text-slate-900 mb-2">บริษัทที่เห็น</h4>
                  <p className="text-[11.5px] text-slate-600 leading-relaxed">
                    ผู้ดูแลระบบติ๊กเลือกบริษัทให้แต่ละคน ผู้ใช้จะเห็นเฉพาะโครงการ ยอดเงิน และ Target ของบริษัทที่ได้รับสิทธิ์ ทุกหน้ารวมถึงไฟล์ Excel
                    — ฐานข้อมูลเป็นตัวบังคับ ไม่ใช่แค่ซ่อนบนหน้าจอ ผู้ที่ยังไม่ได้รับบริษัทใดจะเข้าระบบได้แต่ไม่เห็นข้อมูล
                  </p>
                </Card>
                <Card className="!p-0 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
                        <th className="px-5 py-2.5 text-left font-semibold">สิทธิ์ (ติ๊กได้รายคน)</th>
                        {PERMISSION_TEMPLATES.map((t) => (
                          <th key={t.key} className="px-3 py-2.5 text-center font-semibold w-20">{t.label.split(" ")[0]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-5 py-2.5 text-slate-700">ดูข้อมูลของบริษัทที่ได้รับสิทธิ์</td>
                        {PERMISSION_TEMPLATES.map((t) => (
                          <td key={t.key} className="px-3 py-2.5 text-center text-emerald-600 font-bold">✓</td>
                        ))}
                      </tr>
                      {PERMISSIONS.map((p) => (
                        <tr key={p.key} className="border-t border-slate-100">
                          <td className="px-5 py-2.5 text-slate-700">
                            {p.label}
                            <span className="block text-[10.5px] text-slate-400">{p.hint}</span>
                          </td>
                          {PERMISSION_TEMPLATES.map((t) => (
                            <td key={t.key} className="px-3 py-2.5 text-center font-bold">
                              {t.permissions.includes(p.key) ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">–</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="border-t border-slate-100">
                        <td className="px-5 py-2.5 text-slate-700">จัดการผู้ใช้และ Settings</td>
                        {PERMISSION_TEMPLATES.map((t) => (
                          <td key={t.key} className="px-3 py-2.5 text-center font-bold">
                            {t.isAdmin ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">–</span>}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </Card>
              </div>
              <ul className="mt-3 space-y-1.5 text-[11.5px] text-slate-500 leading-relaxed max-w-2xl">
                <li>— ตารางด้านบนคือค่าเริ่มต้นของ Template แต่ละแบบ ผู้ดูแลระบบปรับรายข้อให้แต่ละคนได้ ผู้ใช้ที่ถูกปรับจะแสดงว่า &quot;(ปรับเอง)&quot;</li>
                <li>— แก้ Template ในภายหลังไม่เปลี่ยนสิทธิ์ของผู้ใช้ที่ตั้งไว้แล้ว</li>
                <li>— สิทธิ์ผู้ดูแลระบบได้ทุกสิทธิ์และเห็นทุกบริษัท ถอดสิทธิ์ของตัวเองไม่ได้ และต้องมีผู้ดูแลอย่างน้อยหนึ่งคนเสมอ</li>
                <li>— Export Excel คุมได้แค่การซ่อนปุ่ม ผู้ที่ดูข้อมูลได้ยังคัดลอกข้อมูลบนจอเองได้</li>
                <li>— ช่อง &quot;ผู้แก้ไข&quot; ในแท็บประวัติบันทึกอีเมลของผู้ที่เข้าระบบอยู่ตอนแก้ไข</li>
              </ul>
            </section>

            <section id="invoices" className="scroll-mt-6">
              <SectionHeading
                num="15"
                title="ใบแจ้งหนี้"
                desc="เมนูสำหรับออกและพิมพ์ใบแจ้งหนี้ แยกจากข้อมูลโครงการ (ไม่ผูกกับงวดเงินบน Roadmap) เห็นเฉพาะผู้ที่ได้รับสิทธิ์ &quot;ออกใบแจ้งหนี้&quot; ซึ่งเห็นใบแจ้งหนี้และบริษัทผู้ออกทั้งหมดในเมนูนี้ — ไม่เกี่ยวกับการติ๊กบริษัท Whitespace Partners / WSCN ของหน้าอื่น"
              />
              <div className="space-y-3">
                <Formula label="การคำนวณยอด">
                  รวมเป็นเงิน = ผลรวมยอดของทุกรายการ
                  <br />ยอดหลังหักส่วนลด = รวมเป็นเงิน − ส่วนลดพิเศษ
                  <br />VAT = ยอดหลังหักส่วนลด × <span className="text-emerald-400">7%</span> (ค่าเริ่มต้นเป็น &quot;ไม่มี VAT&quot; — ถ้าไม่มี VAT แถว VAT จะไม่แสดงบนเอกสาร)
                  <br />จำนวนเงินรวมทั้งสิ้น = ยอดหลังหักส่วนลด + VAT (แสดงเป็นตัวอักษรภาษาไทยในช่อง &quot;จำนวนเงิน&quot; บนเอกสาร)
                  <br />หัก ณ ที่จ่าย = ยอดหลังหักส่วนลด × <span className="text-emerald-400">0 / 1 / 2 / 3 / 5%</span> (คิดจากยอดก่อน VAT)
                  <br />ยอดชำระ = จำนวนเงินรวมทั้งสิ้น − หัก ณ ที่จ่าย
                  <br />รวมเป็นเงินของแต่ละรายการ = จำนวน × ราคา/หน่วย − ส่วนลดรายการ
                </Formula>
                <Formula label="เลขที่เอกสาร">
                  <span className="text-emerald-400">IN-ปีเดือน + ลำดับ 3 หลัก</span> เช่น IN-202610001 — แยกลำดับตามบริษัท และเริ่ม 001 ใหม่ทุกเดือน (ตามเดือนของวันที่เอกสาร)
                  <br />ระบบออกเลขให้ตอนกด &quot;ออกเอกสาร&quot; เท่านั้น ไม่ซ้ำและไม่ข้าม ฉบับร่างยังไม่มีเลข
                </Formula>
              </div>
              <Card className="!p-0 overflow-hidden mt-3">
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["ฉบับร่าง", "แก้ไขและลบได้ ยังพิมพ์ไม่ได้ — กด \"ออกใบแจ้งหนี้\" เพื่อบันทึก รับเลขที่ และเปิดหน้าเอกสารให้พิมพ์ต่อทันที"],
                      ["ออกแล้ว", "ได้เลขที่จริง แก้ไขและลบไม่ได้ เก็บข้อมูลบริษัท ณ วันที่ออก และลายเซ็นของผู้กดออกไว้ในเอกสาร"],
                      ["ยกเลิก", "ทำได้เฉพาะเอกสารที่ออกแล้ว มีลายน้ำ \"ยกเลิก / VOID\" และเลขที่นั้นไม่ถูกนำกลับมาใช้อีก"],
                    ].map(([name, desc], i) => (
                      <tr key={name} className={i !== 0 ? "border-t border-slate-100" : ""}>
                        <td className="font-semibold text-slate-800 px-5 py-3 w-32 align-top">{name}</td>
                        <td className="text-slate-600 px-5 py-3 align-top leading-relaxed">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <ul className="mt-3 space-y-1.5 text-[11.5px] text-slate-500 leading-relaxed max-w-2xl">
                <li>— บริษัทผู้ออกเอกสาร (ชื่อ ที่อยู่ เลขผู้เสียภาษี เบอร์โทร บัญชีธนาคาร โลโก้) เพิ่ม แก้ และลบได้ที่แท็บ &quot;ข้อมูลบริษัท&quot; โดยผู้ดูแลระบบหรือผู้มีสิทธิ์ออกใบแจ้งหนี้ — ลบไม่ได้ถ้ามีใบแจ้งหนี้ที่ออกในนามบริษัทนั้นแล้ว</li>
                <li>— บัญชีรับเงิน (ชื่อบัญชี ธนาคาร เลขที่บัญชี ประเภท สาขา) แสดงเป็นข้อความเหนือหัวข้อ &quot;หมายเหตุและเงื่อนไข&quot; — ช่องไหนเว้นว่างจะไม่แสดง</li>
                <li>— ลายเซ็นของแต่ละคน ผู้ดูแลระบบอัปโหลดให้ในเมนูผู้ใช้งาน ใบที่ออกแล้วยังใช้ลายเซ็นเดิมแม้จะเปลี่ยนรูปภายหลัง</li>
                <li>— ปุ่ม &quot;พิมพ์&quot; สีส้มพิมพ์ต้นฉบับ + สำเนาบนกระดาษ A4 (ลูกศรข้างปุ่มเลือก &quot;เฉพาะต้นฉบับ&quot; ได้) เลือกปลายทางเป็น &quot;Save as PDF&quot; เพื่อได้ไฟล์ PDF — พิมพ์ซ้ำได้จากไอคอนเครื่องพิมพ์ในตาราง ปุ่ม &quot;ดาวน์โหลด PDF&quot; สีฟ้าบันทึกเฉพาะต้นฉบับเป็นไฟล์ PDF ทันที (เปิดหน้าต่าง Save As ให้เลือกที่เก็บใน Chrome / Edge) ไฟล์เป็นภาพของเอกสาร คัดลอกข้อความในไฟล์ไม่ได้</li>
                <li>— เลขประจำตัวผู้เสียภาษีของบริษัทและลูกค้าต้องครบ 13 หลัก ระบบใส่ขีดให้อัตโนมัติ เช่น 0-1055-68193-05-2</li>
                <li>— &quot;คัดลอกเป็นใบใหม่&quot; สร้างฉบับร่างจากใบเดิม ใช้ตอนต้องออกใบแทนใบที่ยกเลิก</li>
                <li>— <b className="text-slate-700">สถานะการชำระ:</b> ใบที่ออกแล้วเป็น &quot;รอชำระเงิน&quot; ถ้าเลยวันครบกำหนดจะขึ้น &quot;เกินกำหนดชำระ&quot; สีแดงให้เอง กดปุ่ม &quot;รับชำระ&quot; เพื่อตรวจข้อมูลและยอดสรุปจากใบแจ้งหนี้ แล้วบันทึกวันที่รับชำระ ช่องทาง (โอนเข้าบัญชีบริษัท / เช็ค / เงินสด) และหมายเหตุ — รับเต็มยอดชำระของใบครั้งเดียว (1/1) ไม่แบ่งจ่าย ยกเลิกสถานะชำระได้ถ้ายังไม่ได้ออกใบเสร็จ</li>
                <li>— <b className="text-slate-700">ใบเสร็จรับเงิน:</b> ออกได้เมื่อชำระเงินแล้ว เลขที่ <span className="font-mono">RE-ปีเดือน + ลำดับ 3 หลัก</span> แยกตามบริษัท ใช้ลูกค้า รายการ และยอดจากใบแจ้งหนี้ อ้างอิงเลขใบแจ้งหนี้ ระบุวันที่ชำระและช่องทาง และใส่ลายเซ็นของผู้ออกในช่องผู้รับเงิน — ออกแล้วแก้ไม่ได้ ดูได้ที่ปุ่ม &quot;ดูใบเสร็จ&quot; สีม่วง หรือแท็บ &quot;ใบเสร็จรับเงิน&quot; ยกเลิกได้จากหน้าใบเสร็จแล้วออกใหม่</li>
                <li>— ใบแจ้งหนี้ที่ออกใบเสร็จแล้ว ต้องยกเลิกใบเสร็จก่อน ถึงจะยกเลิกใบแจ้งหนี้หรือยกเลิกสถานะชำระได้</li>
              </ul>
            </section>

            <section id="notes" className="scroll-mt-6">
              <SectionHeading num="16" title="ข้อควรรู้เพิ่มเติม" />
              <p className="text-[11.5px] text-slate-500 mt-3 leading-relaxed max-w-2xl">
                ข้อมูลทุกครั้งที่บันทึกจะถูกเก็บไว้ใน Local Storage ของเบราว์เซอร์ก่อนเสมอ แล้วค่อยพยายามส่งขึ้นฐานข้อมูลกลาง (Supabase) — ถ้าส่งไม่สำเร็จจะมีข้อความแจ้งเตือนสีแดงขึ้นมาให้เห็นชัดเจน
                ข้อมูลจะไม่หายไปไหน แค่ยังไม่ซิงก์ขึ้นส่วนกลาง สำเนาในเบราว์เซอร์จะถูกล้างเมื่อกดออกจากระบบ หรือเมื่อมีคนอื่นเข้าระบบด้วยเครื่องเดียวกัน ถ้ามีรายการที่ยังไม่ได้ส่งขึ้นฐานข้อมูล ระบบจะเตือนก่อนออกจากระบบ
              </p>
            </section>

            <footer className="pt-6 border-t border-slate-200 text-[11px] text-slate-400 leading-relaxed">
              เอกสารนี้สรุปจากพฤติกรรมจริงของโค้ดในระบบ ไม่ใช่ข้อเสนอหรือแผนงาน — หากมีการปรับกติกาการคำนวณหรือสถานะในอนาคต ต้องอัปเดตคู่มือฉบับนี้ตามไปด้วย
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
