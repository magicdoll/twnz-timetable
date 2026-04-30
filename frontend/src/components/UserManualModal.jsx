import { useState } from 'react';

// ── Shared visual components ──────────────────────────────────────────────────

const Step = ({ n, text, sub }) => (
  <div className="d-flex align-items-start gap-3 mb-3">
    <div className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle fw-bold text-white"
      style={{ width: 36, height: 36, minWidth: 36, background: 'linear-gradient(135deg,#FF6B9D,#FF8C42)', fontSize: '1rem' }}>
      {n}
    </div>
    <div>
      <div className="fw-semibold" style={{ color: '#333', fontSize: '0.95rem' }}>{text}</div>
      {sub && <div className="text-muted mt-1" style={{ fontSize: '0.82rem' }}>{sub}</div>}
    </div>
  </div>
);

const Arrow = () => (
  <div className="text-center my-1" style={{ color: '#FF6B9D', fontSize: '1.2rem' }}>↓</div>
);

const FeatureCard = ({ icon, title, desc, color = '#FF6B9D' }) => (
  <div className="rounded-3 p-3 h-100" style={{ background: color + '12', border: `1.5px solid ${color}30` }}>
    <div className="fw-bold mb-1" style={{ color }}>
      <i className={`bi ${icon} me-2`} />{title}
    </div>
    <div className="text-muted" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>{desc}</div>
  </div>
);

const Badge = ({ text, color = '#FF6B9D' }) => (
  <span className="badge rounded-pill px-3 py-2 me-2 mb-2"
    style={{ background: color + '18', color, border: `1px solid ${color}40`, fontSize: '0.8rem', fontWeight: 600 }}>
    {text}
  </span>
);

const VipBadge = ({ text }) => (
  <span className="badge rounded-pill px-3 py-2 me-2 mb-2"
    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '0.8rem', fontWeight: 600 }}>
    ⭐ {text}
  </span>
);

const InfoBox = ({ icon, title, children, color = '#3b82f6' }) => (
  <div className="rounded-3 p-3 mb-3" style={{ background: color + '10', border: `1.5px solid ${color}30` }}>
    <div className="fw-bold mb-2" style={{ color, fontSize: '0.9rem' }}>
      <i className={`bi ${icon} me-2`} />{title}
    </div>
    <div style={{ fontSize: '0.85rem', color: '#444', lineHeight: 1.6 }}>{children}</div>
  </div>
);

const TabCard = ({ icon, num, title, desc }) => (
  <div className="d-flex gap-2 mb-2 p-2 rounded-3" style={{ background: '#fff8fb', border: '1.5px solid #fce0ed' }}>
    <div className="d-flex align-items-center justify-content-center rounded-circle fw-bold text-white flex-shrink-0"
      style={{ width: 28, height: 28, minWidth: 28, background: 'linear-gradient(135deg,#FF6B9D,#FF8C42)', fontSize: '0.75rem' }}>
      {num}
    </div>
    <div>
      <div className="fw-semibold" style={{ fontSize: '0.85rem', color: '#e5548a' }}>
        <i className={`bi ${icon} me-1`} />{title}
      </div>
      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{desc}</div>
    </div>
  </div>
);

// ── Pages ─────────────────────────────────────────────────────────────────────

const pages = [
  // ── Chapter 1 ──────────────────────────────────────────
  {
    chapter: 1, chapterName: 'ภาพรวมระบบ',
    icon: 'bi-house-heart',
    title: 'TWNZ Timetable คืออะไร?',
    render: () => (
      <div>
        <div className="text-center mb-4">
          <div style={{ fontSize: '3.5rem' }}>🏫</div>
          <h4 className="fw-bold mt-2 mb-1" style={{ color: '#e5548a' }}>TWNZ Timetable</h4>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>ระบบจัดตารางเรียน-ตารางสอนสำหรับโรงเรียน</p>
        </div>
        <InfoBox icon="bi-lightbulb-fill" title="ระบบนี้ช่วยอะไรคุณ?" color="#FF6B9D">
          ลดเวลาจัดตารางจากหลายชั่วโมงเหลือเพียงไม่กี่นาที — AI จัดให้อัตโนมัติ ไม่มีครูชน ไม่มีวิชาซ้ำ
        </InfoBox>
        <div className="row g-3">
          <div className="col-6">
            <FeatureCard icon="bi-magic" title="จัดตารางอัตโนมัติ" desc="AI วางวิชาให้ครบตามที่กำหนด ตรงตามเงื่อนไขทุกข้อ" color="#FF6B9D" />
          </div>
          <div className="col-6">
            <FeatureCard icon="bi-pencil-square" title="แก้ไขด้วยตัวเอง" desc="Manual Editor ย้าย/สลับ/ถอดวิชาได้ทุกคาบ" color="#FF8C42" />
          </div>
          <div className="col-6">
            <FeatureCard icon="bi-person-lock" title="ข้อมูลส่วนตัว" desc="ข้อมูลของแต่ละคนแยกกันสมบูรณ์ ไม่ปนกัน" color="#a855f7" />
          </div>
          <div className="col-6">
            <FeatureCard icon="bi-phone" title="ใช้งานทุกอุปกรณ์" desc="รองรับทั้ง Desktop, Tablet และ Mobile" color="#06b6d4" />
          </div>
        </div>
      </div>
    ),
  },
  {
    chapter: 1, chapterName: 'ภาพรวมระบบ',
    icon: 'bi-map',
    title: 'Flow การใช้งานทั้งหมด',
    render: () => (
      <div>
        <div className="d-flex flex-column align-items-center">
          {[
            { n: '1', icon: '✏️', t: 'สมัครสมาชิก / เข้าสู่ระบบ', s: 'กรอก Username + Password' },
            { n: '2', icon: '⚙️', t: 'จัดการข้อมูล', s: 'เพิ่มครู, วิชา, ชั้นเรียน, มอบหมายสอน' },
            { n: '3', icon: '🎲', t: 'กด จัดตาราง', s: 'AI จัดตารางให้อัตโนมัติ (บันทึกทันที)' },
            { n: '4', icon: '🔍', t: 'ตรวจสอบผล', s: 'ดูตารางเรียน + ตารางสอน' },
            { n: '5', icon: '🛠', t: 'แก้ปัญหา (ถ้ามี)', s: 'เปิด Manual Editor ปรับแต่งเพิ่มเติม' },
            { n: '6', icon: '📤', t: 'Export (VIP)', s: 'ดาวน์โหลด Excel หรือ PDF' },
          ].map((s, i) => (
            <div key={i} className="w-100" style={{ maxWidth: 400 }}>
              <div className="d-flex align-items-center gap-3 p-3 rounded-3 mb-1"
                style={{ background: i % 2 === 0 ? '#fff5f9' : '#fff8f0', border: '1.5px solid #fce0ed' }}>
                <span style={{ fontSize: '1.6rem' }}>{s.icon}</span>
                <div>
                  <div className="fw-bold" style={{ color: '#e5548a', fontSize: '0.9rem' }}>
                    <span className="badge me-2 rounded-pill" style={{ background: '#FF6B9D', color: 'white', fontSize: '0.7rem' }}>{s.n}</span>
                    {s.t}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.78rem' }}>{s.s}</div>
                </div>
              </div>
              {i < 5 && <div className="text-center" style={{ color: '#fda4c3', fontSize: '1rem' }}>│</div>}
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── Chapter 2 ──────────────────────────────────────────
  {
    chapter: 2, chapterName: 'Teacher vs VIP',
    icon: 'bi-stars',
    title: 'Teacher ธรรมดา vs VIP',
    render: () => (
      <div>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <div className="rounded-3 p-3 text-center h-100" style={{ background: '#f0f9ff', border: '2px solid #bae6fd' }}>
              <div style={{ fontSize: '2rem' }}>👨‍🏫</div>
              <div className="fw-bold mt-2" style={{ color: '#0369a1' }}>Teacher ธรรมดา</div>
              <div className="badge mt-1" style={{ background: '#e0f2fe', color: '#0369a1' }}>ฟรี</div>
            </div>
          </div>
          <div className="col-6">
            <div className="rounded-3 p-3 text-center h-100" style={{ background: '#fefce8', border: '2px solid #fcd34d' }}>
              <div style={{ fontSize: '2rem' }}>⭐</div>
              <div className="fw-bold mt-2" style={{ color: '#92400e' }}>Teacher VIP</div>
              <div className="badge mt-1" style={{ background: 'linear-gradient(135deg,#ffd700,#ffa500)', color: 'white' }}>100 บาท / 30 วัน</div>
            </div>
          </div>
        </div>
        {[
          { feature: '⚙️ จัดการข้อมูล', teacher: '✅ ไม่จำกัด', vip: '✅ ไม่จำกัด' },
          { feature: '🎲 จัดตารางอัตโนมัติ', teacher: '✅ 3 ครั้ง/วัน', vip: '⭐ ไม่จำกัดครั้ง' },
          { feature: '🛠 Manual Editor', teacher: '✅ ใช้ได้เต็มรูปแบบ', vip: '✅ ใช้ได้เต็มรูปแบบ' },
          { feature: '📊 Export Excel', teacher: '❌ ไม่ได้', vip: '⭐ ได้เลย' },
          { feature: '📄 Export PDF', teacher: '❌ ไม่ได้', vip: '⭐ ได้เลย' },
          { feature: '🔔 Notification', teacher: '✅ มีทั้งหมด', vip: '✅ มีทั้งหมด' },
        ].map((r, i) => (
          <div key={i} className="row g-0 mb-1">
            <div className="col-4 p-2 rounded-start fw-semibold" style={{ background: '#f9fafb', fontSize: '0.82rem', borderLeft: '3px solid #e5e7eb' }}>
              {r.feature}
            </div>
            <div className="col-4 p-2 text-center" style={{ background: '#f0f9ff', fontSize: '0.82rem', color: '#0369a1' }}>
              {r.teacher}
            </div>
            <div className="col-4 p-2 text-center rounded-end" style={{ background: '#fefce8', fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
              {r.vip}
            </div>
          </div>
        ))}
        <InfoBox icon="bi-credit-card" title="วิธีอัปเกรดเป็น VIP" color="#f59e0b">
          Dashboard → ปุ่ม "⭐ อัปเกรด VIP" → โอนเงิน 100 บาท → แนบสลิป → รอ Admin อนุมัติ (ไม่เกิน 24 ชม.)
        </InfoBox>
      </div>
    ),
  },

  // ── Chapter 3 ──────────────────────────────────────────
  {
    chapter: 3, chapterName: 'เริ่มต้นใช้งาน',
    icon: 'bi-rocket-takeoff',
    title: 'สมัครสมาชิกและเข้าสู่ระบบ',
    render: () => (
      <div>
        <InfoBox icon="bi-info-circle" title="ข้อมูลที่ต้องมี" color="#3b82f6">
          Username (A-Z, 0-9), Password (A-Z, 0-9 ≥ 6 ตัว), ชื่อที่แสดง, เบอร์โทร (10 หลัก)
        </InfoBox>
        <div className="row g-3">
          <div className="col-6">
            <div className="rounded-3 p-3 h-100" style={{ background: '#f0fdf4', border: '2px solid #86efac' }}>
              <div className="fw-bold mb-3" style={{ color: '#166534' }}>
                <i className="bi bi-person-plus me-2" />สมัครสมาชิกใหม่
              </div>
              <Step n="1" text="เปิดหน้าแรก" sub="กดปุ่ม 'สมัครสมาชิก' card จะพลิก 3D" />
              <Step n="2" text="กรอกข้อมูล" sub="Username, Password, ชื่อ, เบอร์, Email" />
              <Step n="3" text="กด สมัครสมาชิก" sub="ระบบ redirect ไป Login ให้อัตโนมัติ" />
            </div>
          </div>
          <div className="col-6">
            <div className="rounded-3 p-3 h-100" style={{ background: '#fdf4ff', border: '2px solid #d8b4fe' }}>
              <div className="fw-bold mb-3" style={{ color: '#6b21a8' }}>
                <i className="bi bi-box-arrow-in-right me-2" />เข้าสู่ระบบ
              </div>
              <Step n="1" text="กรอก Username" sub="ที่สมัครไว้" />
              <Step n="2" text="กรอก Password" sub="" />
              <Step n="3" text="กด เข้าสู่ระบบ" sub="ระบบจำ session ไว้ 7 วัน" />
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-3 text-center" style={{ background: 'linear-gradient(135deg,#fff5f9,#fff8f0)', border: '2px dashed #fda4c3' }}>
          <div style={{ fontSize: '1.5rem' }}>💡</div>
          <div className="fw-semibold mt-1" style={{ color: '#e5548a', fontSize: '0.9rem' }}>
            หลัง Login สำเร็จ → ไปหน้า Dashboard
          </div>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>เริ่มจัดการข้อมูลได้ทันที กด ⚙️ จัดการข้อมูล</div>
        </div>
      </div>
    ),
  },

  // ── Chapter 4 ──────────────────────────────────────────
  {
    chapter: 4, chapterName: 'จัดการข้อมูล',
    icon: 'bi-gear-fill',
    title: 'จัดการข้อมูล 8 หมวด (ส่วนที่ 1)',
    render: () => (
      <div>
        <InfoBox icon="bi-arrow-right-circle" title="วิธีเปิด" color="#FF6B9D">
          Dashboard → ปุ่ม ⚙️ จัดการข้อมูล → Modal เต็มจอ มี 8 Tab
        </InfoBox>
        <div className="mb-2 fw-bold" style={{ color: '#e5548a', fontSize: '0.85rem' }}>
          <i className="bi bi-1-circle me-1" />–<i className="bi bi-4-circle me-1" /> Tab พื้นฐาน
        </div>
        <TabCard num="1" icon="bi-people" title="ครูผู้สอน" desc="เพิ่ม/แก้ไข/ลบ ชื่อครู, ชื่อเล่น — ดูภาระงาน คาบ/สัปดาห์" />
        <TabCard num="2" icon="bi-book" title="วิชา" desc="เพิ่มวิชา + รหัส, เลือกสีประจำวิชา 16 สีสำเร็จรูป + custom" />
        <TabCard num="3" icon="bi-building" title="ชั้นเรียน & ห้อง" desc="สร้างชั้นเรียน (ป.1–ม.3), กำหนดจำนวนห้อง, ระบบตั้งชื่อให้อัตโนมัติ" />
        <TabCard num="4" icon="bi-clock" title="เวลาคาบ" desc="กำหนดเวลาเริ่ม-สิ้นสุดแต่ละคาบ, เพิ่ม/ลบคาบได้เอง" />
        <div className="mt-3 p-2 rounded-3 d-flex align-items-center gap-2" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <span style={{ fontSize: '1.2rem' }}>💡</span>
          <span style={{ fontSize: '0.82rem', color: '#92400e' }}>
            <b>ลำดับแนะนำ:</b> Tab 1 → 2 → 3 → 4 ก่อนไปขั้นตอนถัดไป
          </span>
        </div>
      </div>
    ),
  },
  {
    chapter: 4, chapterName: 'จัดการข้อมูล',
    icon: 'bi-gear-wide-connected',
    title: 'จัดการข้อมูล 8 หมวด (ส่วนที่ 2)',
    render: () => (
      <div>
        <div className="mb-2 fw-bold" style={{ color: '#e5548a', fontSize: '0.85rem' }}>
          <i className="bi bi-5-circle me-1" />–<i className="bi bi-8-circle me-1" /> Tab ขั้นสูง
        </div>
        <TabCard num="5" icon="bi-calendar3" title="คาบ/วัน" desc="กำหนดจำนวนคาบต่อวัน (จ-ศ) ของแต่ละห้อง, ตั้งทีเดียวทั้งชั้นได้" />
        <TabCard num="6" icon="bi-person-lines-fill" title="มอบหมายสอน" desc="เลือกครู + วิชา + หลายห้องพร้อมกัน + กำหนดคาบ/สัปดาห์" />
        <TabCard num="7" icon="bi-lock" title="ล็อคคาบ (Fixed Slots)" desc="ล็อควิชาเฉพาะวัน/คาบ เช่น ลูกเสือวันพุธคาบ 5 ทั้งโรงเรียน" />
        <TabCard num="8" icon="bi-calendar-x" title="ครูไม่ว่าง" desc="กำหนดคาบที่ครูแต่ละคนสอนไม่ได้ ระบบจะไม่วางวิชาในช่วงนั้น" />
        <InfoBox icon="bi-check2-circle" title="Validation ก่อนจัดตาราง" color="#10b981">
          ระบบตรวจอัตโนมัติว่าแต่ละห้องมีวิชาครบตามคาบที่กำหนดหรือยัง
          — card สีเขียว ✅ = พร้อมจัดตาราง | card สีส้ม ⚠️ = ยังไม่ครบ
        </InfoBox>
      </div>
    ),
  },

  // ── Chapter 5 ──────────────────────────────────────────
  {
    chapter: 5, chapterName: 'จัดตารางอัตโนมัติ',
    icon: 'bi-shuffle',
    title: 'การจัดตารางอัตโนมัติ',
    render: () => (
      <div>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <div className="rounded-3 p-3 text-center" style={{ background: '#f0f9ff', border: '2px solid #bae6fd' }}>
              <div style={{ fontSize: '2rem' }}>👨‍🏫</div>
              <div className="fw-bold" style={{ color: '#0369a1', fontSize: '0.9rem' }}>Teacher ธรรมดา</div>
              <div className="mt-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0369a1' }}>3 ครั้ง</div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>ต่อวัน (รีเซ็ตทุกเที่ยงคืน)</div>
            </div>
          </div>
          <div className="col-6">
            <div className="rounded-3 p-3 text-center" style={{ background: '#fefce8', border: '2px solid #fcd34d' }}>
              <div style={{ fontSize: '2rem' }}>⭐</div>
              <div className="fw-bold" style={{ color: '#92400e', fontSize: '0.9rem' }}>Teacher VIP</div>
              <div className="mt-1" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#92400e' }}>∞ ครั้ง</div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>ไม่จำกัดจำนวน</div>
            </div>
          </div>
        </div>
        <div className="fw-bold mb-2" style={{ color: '#e5548a', fontSize: '0.88rem' }}>
          <i className="bi bi-cpu me-1" />AI ทำงานอย่างไร?
        </div>
        {[
          { icon: '🔒', t: 'วาง Fixed Slots ก่อน', d: 'วิชาที่ล็อคไว้ถูกวางก่อนเสมอ' },
          { icon: '🔀', t: 'สุ่มลำดับวิชา', d: 'สร้างความหลากหลายทุกครั้งที่กด' },
          { icon: '🧩', t: 'วางวิชาทีละรายการ', d: 'ตรวจครูว่าง / ไม่ซ้ำในวันเดียว / ตรงเงื่อนไข' },
          { icon: '🔄', t: 'ลองสลับถ้าวางไม่ได้', d: 'ระบบหาทางแก้ก่อน warning' },
          { icon: '💾', t: 'บันทึกอัตโนมัติ', d: 'ผลลัพธ์ถูกบันทึกทันที กลับมาดูได้เสมอ' },
        ].map((s, i) => (
          <div key={i} className="d-flex align-items-start gap-2 mb-2">
            <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
            <div>
              <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>{s.t}</span>
              <span className="text-muted ms-2" style={{ fontSize: '0.8rem' }}>{s.d}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    chapter: 5, chapterName: 'จัดตารางอัตโนมัติ',
    icon: 'bi-exclamation-triangle',
    title: 'รายการปัญหาที่อาจเกิด',
    render: () => (
      <div>
        <InfoBox icon="bi-info-circle" title="เมื่อจัดตารางเสร็จ ระบบจะแจ้ง..." color="#f59e0b">
          ถ้าวางวิชาบางรายการไม่ได้ หรือมีช่องว่างในตาราง จะปรากฏ Warning card แสดงรายห้อง
        </InfoBox>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <div className="rounded-3 p-3" style={{ background: '#fef3c7', border: '2px solid #fcd34d' }}>
              <div className="fw-bold mb-2" style={{ color: '#92400e', fontSize: '0.88rem' }}>⚠️ วิชาลงไม่ได้</div>
              <div className="text-muted" style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                ครูถูกใช้ในห้องอื่นแล้ว หรือไม่มีคาบว่างเหลือ — ระบบบอกว่าวิชาไหน ห้องไหน ขาดกี่คาบ
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="rounded-3 p-3" style={{ background: '#fce7f3', border: '2px solid #f9a8d4' }}>
              <div className="fw-bold mb-2" style={{ color: '#9d174d', fontSize: '0.88rem' }}>□ ช่องว่าง</div>
              <div className="text-muted" style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                คาบเรียนที่ยังไม่มีวิชา — มักเกิดเมื่อ assignment รวมน้อยกว่าคาบทั้งหมด
              </div>
            </div>
          </div>
        </div>
        <div className="fw-bold mb-2" style={{ color: '#e5548a', fontSize: '0.88rem' }}>
          <i className="bi bi-tools me-1" />วิธีแก้ปัญหา
        </div>
        <Step n="1" text="คลิก card ห้องที่มีปัญหา" sub="ระบบเปิด Manual Editor ให้อัตโนมัติ" />
        <Step n="2" text="เลือกวิชาจากรายการซ้ายมือ" sub="ไฮไลท์ช่องที่วางได้ (กระพริบสีเขียว)" />
        <Step n="3" text="คลิกช่องที่ไฮไลท์" sub="วิชาลงทันที บันทึกอัตโนมัติ" />
      </div>
    ),
  },

  // ── Chapter 6 ──────────────────────────────────────────
  {
    chapter: 6, chapterName: 'Manual Editor',
    icon: 'bi-pencil-square',
    title: 'Manual Editor คืออะไร?',
    render: () => (
      <div>
        <InfoBox icon="bi-lightbulb" title="ใช้เมื่อไหร่?" color="#8b5cf6">
          เมื่อ AI จัดตารางแล้วมีปัญหา หรืออยากปรับตารางให้ตรงความต้องการมากขึ้น
        </InfoBox>
        <div className="fw-bold mb-3" style={{ color: '#e5548a', fontSize: '0.88rem' }}>Layout ของ Manual Editor</div>
        <div className="rounded-3 overflow-hidden mb-3" style={{ border: '2px solid #e9d5ff' }}>
          {/* Header */}
          <div className="p-2 text-center fw-bold text-white" style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', fontSize: '0.85rem' }}>
            Manual Editor — ห้อง ป.5/1
          </div>
          <div className="d-flex" style={{ minHeight: 120 }}>
            {/* Left panel */}
            <div className="p-2" style={{ width: '30%', background: '#faf5ff', borderRight: '1px solid #e9d5ff', fontSize: '0.72rem' }}>
              <div className="fw-bold mb-1" style={{ color: '#7c3aed' }}>📋 รายการวิชาที่ขาด</div>
              <div className="rounded p-1 mb-1" style={{ background: '#ede9fe', fontSize: '0.68rem' }}>คณิต (ครูก) ขาด 2 คาบ</div>
              <div className="rounded p-1 mb-2" style={{ background: '#ede9fe', fontSize: '0.68rem' }}>ไทย (ครูข) ขาด 1 คาบ</div>
              <div className="text-muted" style={{ fontSize: '0.62rem' }}>+ สัญลักษณ์สี</div>
            </div>
            {/* Right panel */}
            <div className="p-2 flex-grow-1" style={{ fontSize: '0.72rem' }}>
              {/* ตารางเรียน */}
              <div className="fw-bold mb-1" style={{ color: '#7c3aed' }}>📅 ตารางเรียนห้อง ป.5/1</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, fontSize: '0.6rem', marginBottom: 8 }}>
                {['วัน','ค.1','ค.2','ค.3','จ','คณิต','วิทย์','ว่าง','อ','ไทย','ศิลปะ','ว่าง'].map((c, i) => (
                  <div key={i} className="p-1 rounded text-center"
                    style={{ background: i < 4 ? '#e9d5ff' : c === 'ว่าง' ? '#f0fdf4' : '#fce7f3', fontSize: '0.58rem' }}>
                    {c}
                  </div>
                ))}
              </div>
              {/* ตารางสอนครู — อยู่ใต้ตารางเรียน */}
              <div className="fw-bold mb-1" style={{ color: '#7c3aed', fontSize: '0.68rem' }}>
                👨‍🏫 ตารางสอนครู (แสดงใต้ตารางเรียน — 2 ตาราง/แถว)
              </div>
              <div className="d-flex gap-1">
                {['ครูก', 'ครูข'].map((t) => (
                  <div key={t} className="rounded p-1 flex-grow-1" style={{ background: '#f3e8ff', fontSize: '0.6rem', border: '1px solid #d8b4fe' }}>
                    <div className="fw-bold" style={{ color: '#7c3aed' }}>{t}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, marginTop: 2 }}>
                      {['จ','อ','พ','คณิต','—','ไทย'].map((x,i) => (
                        <div key={i} style={{ background: i < 3 ? '#e9d5ff' : x === '—' ? '#f9f9f9' : '#fce7f3', borderRadius: 2, padding: '1px 2px', fontSize: '0.55rem', textAlign: 'center' }}>{x}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    chapter: 6, chapterName: 'Manual Editor',
    icon: 'bi-arrows-move',
    title: 'วิธีใช้ Manual Editor',
    render: () => (
      <div>
        <div className="row g-2 mb-3">
          {[
            { icon: '🟢', color: '#10b981', t: 'ช่องสีเขียวกระพริบ', d: 'วางได้ / ย้ายได้ — คลิกเพื่อดำเนินการทันที' },
            { icon: '🔵', color: '#3b82f6', t: 'ช่องสีน้ำเงินกระพริบ', d: 'สลับได้ — คลิกเพื่อสลับวิชากัน' },
            { icon: '🟠', color: '#f59e0b', t: 'ช่องสีส้มกระพริบ', d: 'ช่องที่กำลังเลือกอยู่' },
            { icon: '⬜', color: '#9ca3af', t: 'ช่องสีเทา (ซีด)', d: 'ไม่เกี่ยวข้อง — ไม่ต้องสนใจ' },
          ].map((b, i) => (
            <div key={i} className="col-6">
              <div className="rounded-3 p-2" style={{ background: b.color + '10', border: `1.5px solid ${b.color}30` }}>
                <div className="fw-semibold" style={{ color: b.color, fontSize: '0.82rem' }}>{b.icon} {b.t}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{b.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="fw-bold mb-2" style={{ color: '#e5548a', fontSize: '0.88rem' }}>4 การกระทำที่ทำได้</div>
        {[
          { n: '①', t: 'วางวิชาที่ขาด', d: 'คลิกวิชาในรายการซ้าย → คลิกช่องสีเขียว' },
          { n: '②', t: 'ย้ายวิชา', d: 'คลิกช่องวิชา → คลิกช่องว่างสีเขียว' },
          { n: '③', t: 'สลับวิชา', d: 'คลิกช่องวิชา → คลิกวิชาอื่นสีน้ำเงิน' },
          { n: '④', t: 'ถอดวิชาออก', d: 'คลิกช่องวิชา → กดปุ่ม "ถอดวิชาออก → pending"' },
        ].map((a, i) => (
          <div key={i} className="d-flex align-items-start gap-2 mb-2">
            <span className="badge rounded-pill" style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', color: 'white', minWidth: 24 }}>{a.n}</span>
            <div>
              <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>{a.t}</span>
              <span className="text-muted ms-2" style={{ fontSize: '0.78rem' }}>{a.d}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },

  // ── Chapter 7 ──────────────────────────────────────────
  {
    chapter: 7, chapterName: 'Export (VIP)',
    icon: 'bi-download',
    title: 'Export Excel & PDF',
    render: () => (
      <div>
        <div className="rounded-3 p-2 mb-3 d-flex align-items-center gap-2" style={{ background: '#fefce8', border: '2px solid #fcd34d' }}>
          <span style={{ fontSize: '1.3rem' }}>⭐</span>
          <span className="fw-semibold" style={{ color: '#92400e', fontSize: '0.88rem' }}>
            ฟีเจอร์นี้ใช้ได้เฉพาะ Teacher VIP เท่านั้น
          </span>
        </div>
        <div className="row g-3 mb-3">
          <div className="col-6">
            <div className="rounded-3 p-3 h-100" style={{ background: '#f0fdf4', border: '2px solid #86efac' }}>
              <div className="fw-bold mb-2" style={{ color: '#166534' }}>
                <i className="bi bi-file-earmark-excel me-2" />Excel
              </div>
              <div className="text-muted mb-2" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                ไฟล์ .xlsx มี 2 Sheet
              </div>
              <div style={{ fontSize: '0.78rem' }}>
                <div>📋 Sheet 1: ตารางเรียน (แต่ละห้อง)</div>
                <div>📋 Sheet 2: ตารางสอน (แต่ละครู)</div>
                <div className="mt-2 text-muted">Rows = วัน | Cols = คาบ<br />สีตามวิชาทุก cell</div>
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="rounded-3 p-3 h-100" style={{ background: '#fef2f2', border: '2px solid #fca5a5' }}>
              <div className="fw-bold mb-2" style={{ color: '#991b1b' }}>
                <i className="bi bi-file-earmark-pdf me-2" />PDF
              </div>
              <div className="text-muted mb-2" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                ไฟล์ .pdf A4 Landscape
              </div>
              <div style={{ fontSize: '0.78rem' }}>
                <div>📄 1 หน้า = 1 ห้อง/ครู</div>
                <div>🎨 สีตามวิชา ฟอนต์ไทย</div>
                <div className="mt-2 text-muted">ตารางเรียน + ตารางสอน<br />ครบทุกห้องทุกครู</div>
              </div>
            </div>
          </div>
        </div>
        <InfoBox icon="bi-check2-all" title="เงื่อนไขการ Export" color="#10b981">
          ตารางต้องสมบูรณ์ก่อน (ไม่มีช่องว่าง + ไม่มีวิชาค้าง) จึงจะเห็นปุ่ม Export บนหน้าจัดตาราง
        </InfoBox>
        <Step n="1" text="แก้ปัญหาจนตารางครบ" sub="badge เปลี่ยนเป็น 🟢 สมบูรณ์" />
        <Step n="2" text="กดปุ่ม Excel หรือ PDF" sub="ดาวน์โหลดอัตโนมัติ" />
      </div>
    ),
  },
];

// ── Chapter map ───────────────────────────────────────────────────────────────

const chapters = [
  { id: 1, name: 'ภาพรวมระบบ',         icon: 'bi-house-heart' },
  { id: 2, name: 'Teacher vs VIP',      icon: 'bi-stars' },
  { id: 3, name: 'เริ่มต้นใช้งาน',      icon: 'bi-rocket-takeoff' },
  { id: 4, name: 'จัดการข้อมูล',        icon: 'bi-gear-fill' },
  { id: 5, name: 'จัดตารางอัตโนมัติ',   icon: 'bi-shuffle' },
  { id: 6, name: 'Manual Editor',       icon: 'bi-pencil-square' },
  { id: 7, name: 'Export (VIP ⭐)',      icon: 'bi-download' },
];

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function UserManualModal({ show, onClose }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState('next');

  if (!show) return null;

  const page = pages[pageIdx];
  const totalPages = pages.length;

  const go = (newIdx, direction) => {
    if (animating || newIdx < 0 || newIdx >= totalPages) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => {
      setPageIdx(newIdx);
      setAnimating(false);
    }, 220);
  };

  const goChapter = (chId) => {
    const idx = pages.findIndex((p) => p.chapter === chId);
    if (idx >= 0) go(idx, idx > pageIdx ? 'next' : 'prev');
  };

  const pagesInChapter = pages.filter((p) => p.chapter === page.chapter);
  const pageInChapter  = pagesInChapter.findIndex((p) => p === page) + 1;

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 1200 }}>
      <style>{`
        @keyframes slideInNext { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInPrev { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }
        .page-anim-next { animation: slideInNext 0.22s ease-out; }
        .page-anim-prev { animation: slideInPrev 0.22s ease-out; }
      `}</style>
      <div className="modal-dialog modal-dialog-centered"
        style={{ maxWidth: 900, width: '92vw', margin: 'auto' }}>
        <div className="modal-content border-0 rounded-4 overflow-hidden"
          style={{ background: '#fdf6fa', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

          {/* ── Header ── */}
          <div className="d-flex align-items-center px-4 py-3 border-bottom"
            style={{ background: 'linear-gradient(135deg,#FF6B9D,#FF8C42)', color: 'white' }}>
            <span style={{ fontSize: '1.4rem' }}>📖</span>
            <div className="ms-3">
              <div className="fw-bold" style={{ fontSize: '1.05rem' }}>คู่มือการใช้งาน TWNZ Timetable</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                บท {page.chapter} — {chapters.find(c => c.id === page.chapter)?.name}
                &nbsp;·&nbsp; หน้า {pageInChapter}/{pagesInChapter.length}
              </div>
            </div>
            <button className="btn ms-auto" style={{ color: 'white', fontSize: '1.5rem', lineHeight: 1 }} onClick={onClose}>
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="d-flex overflow-hidden" style={{ flex: 1, minHeight: 0 }}>

            {/* ── Sidebar ── */}
            <div style={{ width: 200, minWidth: 200, background: 'white', borderRight: '1px solid #fce0ed', overflowY: 'auto', padding: '0.75rem 0' }}>
              <div className="px-3 mb-2" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#aaa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                สารบัญ
              </div>
              {chapters.map((ch) => {
                const isActive = page.chapter === ch.id;
                const chPages = pages.filter((p) => p.chapter === ch.id);
                return (
                  <div key={ch.id}>
                    <button
                      className="btn w-100 text-start px-3 py-2 d-flex align-items-center gap-2"
                      style={{
                        background: isActive ? 'var(--pink-light)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--pink)' : '3px solid transparent',
                        borderRadius: 0,
                        color: isActive ? 'var(--pink-dark)' : '#666',
                        fontWeight: isActive ? 700 : 400,
                        fontSize: '0.82rem',
                        transition: 'all 0.15s',
                      }}
                      onClick={() => goChapter(ch.id)}>
                      <i className={`bi ${ch.icon}`} style={{ fontSize: '0.9rem', flexShrink: 0 }} />
                      <span>{ch.name}</span>
                      {chPages.length > 1 && (
                        <span className="badge rounded-pill ms-auto" style={{ background: isActive ? 'var(--pink)' : '#e5e7eb', color: isActive ? 'white' : '#666', fontSize: '0.65rem' }}>
                          {chPages.length}
                        </span>
                      )}
                    </button>
                    {isActive && chPages.length > 1 && chPages.map((cp, ci) => {
                      const cpIdx = pages.indexOf(cp);
                      const isCurrentPage = cpIdx === pageIdx;
                      return (
                        <button key={ci}
                          className="btn w-100 text-start py-1"
                          style={{ paddingLeft: '2.8rem', fontSize: '0.75rem', color: isCurrentPage ? 'var(--pink)' : '#999', background: 'transparent', fontWeight: isCurrentPage ? 600 : 400 }}
                          onClick={() => go(cpIdx, cpIdx > pageIdx ? 'next' : 'prev')}>
                          {isCurrentPage ? '▶ ' : '○ '}{cp.title}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* ── Page Content ── */}
            <div className="flex-grow-1 d-flex flex-column" style={{ overflow: 'hidden' }}>
              <div className="flex-grow-1 overflow-auto p-4">
                <div className={animating ? (dir === 'next' ? 'page-anim-next' : 'page-anim-prev') : ''}>
                  {/* Page title */}
                  <div className="mb-4 pb-2 border-bottom d-flex align-items-center gap-2"
                    style={{ borderColor: '#fce0ed !important' }}>
                    <i className={`bi ${page.icon}`} style={{ color: 'var(--pink)', fontSize: '1.3rem' }} />
                    <h5 className="fw-bold mb-0" style={{ color: '#e5548a' }}>{page.title}</h5>
                  </div>
                  {/* Page body */}
                  <div style={{ maxWidth: 680 }}>
                    {page.render()}
                  </div>
                </div>
              </div>

              {/* ── Navigation ── */}
              <div className="d-flex align-items-center justify-content-between px-4 py-3 border-top"
                style={{ background: 'white', borderColor: '#fce0ed' }}>
                <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                  disabled={pageIdx === 0}
                  onClick={() => go(pageIdx - 1, 'prev')}>
                  <i className="bi bi-chevron-left" />ก่อนหน้า
                </button>
                <div className="d-flex gap-1">
                  {pages.map((_, i) => (
                    <button key={i}
                      className="btn p-0 rounded-circle"
                      style={{ width: 8, height: 8, minWidth: 8, background: i === pageIdx ? 'var(--pink)' : '#e5e7eb', border: 'none', transition: 'all 0.15s' }}
                      onClick={() => go(i, i > pageIdx ? 'next' : 'prev')}
                    />
                  ))}
                </div>
                <button className="btn btn-pink btn-sm d-flex align-items-center gap-2"
                  disabled={pageIdx === totalPages - 1}
                  onClick={() => go(pageIdx + 1, 'next')}>
                  ถัดไป<i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
