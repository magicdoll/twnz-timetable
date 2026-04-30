import Swal from 'sweetalert2';

// ─── Theme colors ────────────────────────────────────────────────────────────
const PINK   = '#FF6B9D';
const ORANGE = '#FF8C42';

// ─── Toast (แจ้งเตือนมุมขวาบน) ─────────────────────────────────────────────
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const toast = {
  success: (msg) => Toast.fire({ icon: 'success', title: msg }),
  error:   (msg) => Toast.fire({ icon: 'error',   title: msg, timer: 4000 }),
  warning: (msg) => Toast.fire({ icon: 'warning', title: msg }),
  info:    (msg) => Toast.fire({ icon: 'info',    title: msg }),
};

// ─── Confirm dialog ──────────────────────────────────────────────────────────
export const confirm = async ({
  title = 'ยืนยันการดำเนินการ',
  text = '',
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  icon = 'warning',
  danger = false,
} = {}) => {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? '#ef4444' : PINK,
    cancelButtonColor: '#9ca3af',
    reverseButtons: true,
    customClass: { popup: 'swal-thai-font' },
  });
  return result.isConfirmed;
};

// ─── Alert (แค่แจ้ง ไม่ต้อง confirm) ────────────────────────────────────────
export const alert = ({
  title,
  text = '',
  icon = 'info',
} = {}) =>
  Swal.fire({
    title,
    text,
    icon,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: PINK,
    customClass: { popup: 'swal-thai-font' },
  });
