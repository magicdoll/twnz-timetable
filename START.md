# วิธีเริ่มใช้งาน TWNZ Timetable — Phase 1

## ขั้นตอนที่ 1: เตรียม MySQL

ตรวจสอบว่า MySQL กำลังรันอยู่บน localhost:3306
- user: root / pass: P@ssw0rd

## ขั้นตอนที่ 2: Setup Database (ทำครั้งเดียว)

```bash
cd backend
npm run setup
```

จะสร้าง database, tables ทั้งหมด และ seed ข้อมูลเริ่มต้น:
- admin / Admin@1234 (role: admin)
- teacher1 / Teacher@1234 (role: teacher)
- teacher2 / Teacher@1234 (role: teacher)

## ขั้นตอนที่ 3: รันทั้งระบบพร้อมกัน (terminal เดียว)

```bash
# อยู่ที่ root (twnz-timetable/)
npm start
```

- **Backend** รันที่ http://localhost:5000 — รีสตาร์ทอัตโนมัติเมื่อแก้ไขไฟล์ (nodemon)
- **Frontend** รันที่ http://localhost:5173 — Hot-reload อัตโนมัติเมื่อแก้ไขไฟล์ (Vite HMR)

> หรือรันแยกก็ได้:
> ```bash
> cd backend && npm run dev   # terminal 1
> cd frontend && npm run dev  # terminal 2
> ```

## PromptPay QR

แก้ไข `backend/.env` → `PROMPTPAY_ID=หมายเลขพร้อมเพย์จริง`

## โครงสร้างไฟล์

```
twnz-timetable/
├── schema.sql          ← schema อ้างอิง
├── backend/
│   ├── .env            ← config DB + JWT
│   ├── server.js
│   ├── uploads/        ← สลิปที่ upload
│   └── src/
│       ├── config/database.js
│       ├── middleware/auth.js, upload.js
│       ├── routes/auth.js, admin.js, payment.js, ...
│       └── scripts/setup-db.js
└── frontend/
    └── src/
        ├── pages/AuthPage.jsx, Dashboard.jsx, PaymentPage.jsx, AdminPage.jsx
        ├── components/Layout.jsx, TopBar.jsx, Sidebar.jsx, NotificationDropdown.jsx
        ├── contexts/AuthContext.jsx
        └── services/api.js
```
