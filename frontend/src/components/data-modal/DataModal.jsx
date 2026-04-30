import { useState, useEffect, useCallback } from 'react';
import TabTeachers from './TabTeachers';
import TabSubjects from './TabSubjects';
import TabGrades from './TabGrades';
import TabPeriodSlots from './TabPeriodSlots';
import TabDayPeriods from './TabDayPeriods';
import TabAssignments from './TabAssignments';
import TabFixedSlots from './TabFixedSlots';
import TabUnavailable from './TabUnavailable';
import api from '../../services/api';

const TABS = [
  { key: 'teachers',    icon: 'bi-people',        label: 'ครูผู้สอน' },
  { key: 'grades',      icon: 'bi-building',       label: 'ชั้นเรียน & ห้อง' },
  { key: 'subjects',    icon: 'bi-book',           label: 'วิชา' },
  { key: 'periods',     icon: 'bi-clock',          label: 'เวลาคาบ' },
  { key: 'dayperiods',  icon: 'bi-calendar3',      label: 'คาบ/วัน' },
  { key: 'assignments', icon: 'bi-person-lines-fill', label: 'มอบหมายสอน' },
  { key: 'fixedslots',  icon: 'bi-lock',           label: 'ล็อคคาบ' },
  { key: 'unavailable', icon: 'bi-calendar-x',    label: 'ครูไม่ว่าง' },
];

export default function DataModal({ show, onClose }) {
  const [tab, setTab] = useState('teachers');
  const [grades, setGrades] = useState([]);

  const loadGrades = useCallback(async () => {
    try { const { data } = await api.get('/grades'); setGrades(data); } catch {}
  }, []);

  useEffect(() => {
    if (show) { loadGrades(); }
  }, [show, loadGrades]);

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content border-0" style={{ borderRadius: 0 }}>

          {/* Header */}
          <div className="modal-header border-0 gradient-pink-orange text-white px-4 py-3">
            <div className="d-flex align-items-center gap-3">
              <span style={{ fontSize: '1.5rem' }}>⚙️</span>
              <div>
                <h5 className="modal-title mb-0 fw-bold">จัดการข้อมูล</h5>
                <small style={{ opacity: 0.85 }}>กรอกข้อมูลให้ครบก่อนจัดตาราง</small>
              </div>
            </div>
            <button className="btn ms-auto" style={{ color: 'white', fontSize: '1.4rem', lineHeight: 1 }}
              onClick={onClose}>
              <i className="bi bi-x-lg" />
            </button>
          </div>

          {/* Tab Nav */}
          <div className="border-bottom" style={{ background: '#fff', overflowX: 'auto' }}>
            <div className="d-flex px-3" style={{ minWidth: 'max-content' }}>
              {TABS.map(({ key, icon, label }) => (
                <button key={key}
                  className={`btn px-3 py-3 rounded-0 border-0 border-bottom border-3 fw-semibold`}
                  style={{
                    borderBottomColor: tab === key ? 'var(--pink)' : 'transparent',
                    color: tab === key ? 'var(--pink)' : '#666',
                    background: tab === key ? 'var(--pink-light)' : 'transparent',
                    borderBottomWidth: 3,
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => setTab(key)}>
                  <i className={`bi ${icon} me-2`} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-4" style={{ overflowY: 'auto', background: 'var(--bg)' }}>
            {tab === 'teachers'    && <TabTeachers />}
            {tab === 'subjects'    && <TabSubjects grades={grades} />}
            {tab === 'grades'      && <TabGrades onGradesChange={setGrades} />}
            {tab === 'periods'     && <TabPeriodSlots grades={grades} />}
            {tab === 'dayperiods'  && <TabDayPeriods grades={grades} />}
            {tab === 'assignments' && <TabAssignments grades={grades} />}
            {tab === 'fixedslots'  && <TabFixedSlots grades={grades} />}
            {tab === 'unavailable' && <TabUnavailable grades={grades} />}
          </div>
        </div>
      </div>
    </div>
  );
}
