const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

// แถว = วัน, คอลัมน์ = คาบ
export default function ScheduleTable({ slots, periods, entities, entityKey, labelKey, onCellClick, onEntityAction, entityActionLabel = '✏️ Manual' }) {
  const getCell = (entityId, day, period) =>
    slots.find((s) => s[entityKey] === entityId && s.day === day && s.period === period);

  return (
    <div className="d-flex flex-column gap-5">
      {entities.map((entity) => {
        const entityId = entity.id;
        const entitySlots = slots.filter((s) => s[entityKey] === entityId);

        return (
          <div key={entityId}>
            <div className="fw-bold mb-2 d-flex align-items-center gap-2"
              style={{ color: 'var(--pink-dark)', fontSize: '1rem' }}>
              <i className={`bi bi-${entityKey === 'room_id' ? 'door-open' : 'person-badge'}`} />
              {entity[labelKey]}
              {entity.nickname && <span className="text-muted small">({entity.nickname})</span>}
              {onEntityAction && (
                <button className="btn btn-sm ms-2"
                  style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', color: 'white', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 20 }}
                  onClick={() => onEntityAction(entity)}>
                  {entityActionLabel}
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table style={{ minWidth: 500, width: '100%', borderCollapse: 'separate', borderSpacing: 3 }}>
                <thead>
                  <tr>
                    {/* หัวคอลัมน์ซ้ายสุด = "วัน" label */}
                    <th style={thDayStyle}>วัน \ คาบ</th>
                    {periods.map((p) => (
                      <th key={p.period_number} style={thPeriodStyle}>
                        <div style={{ fontWeight: 700 }}>คาบ {p.period_number}</div>
                        <div style={{ fontWeight: 400, fontSize: '0.68rem', opacity: 0.8, marginTop: 1 }}>
                          {p.start_time?.slice(0, 5)}–{p.end_time?.slice(0, 5)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => (
                    <tr key={day}>
                      {/* หัวแถว = วัน */}
                      <td style={tdDayStyle}>{day}</td>
                      {periods.map((p) => {
                        const slot = getCell(entityId, day, p.period_number);
                        return (
                          <td key={p.period_number}
                            onClick={() => onCellClick?.(slot, entityId, day, p.period_number)}
                            style={{
                              ...tdDataStyle,
                              background: slot ? (slot.color_bg || '#f0f0f0') : '#fafafa',
                              border: `2px solid ${slot ? (slot.color_border || '#ddd') : '#ececec'}`,
                              cursor: onCellClick ? 'pointer' : 'default',
                            }}>
                            {slot ? (
                              <div>
                                <div style={{ color: slot.color_text || '#333', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.3 }}>
                                  {slot.subject_name}{slot.is_fixed ? ' 🔒' : ''}
                                </div>
                                {entityKey === 'room_id' && slot.teacher_name && (
                                  <div style={{ color: slot.color_text || '#666', opacity: 0.75, fontSize: '0.68rem', marginTop: 2 }}>
                                    {slot.nickname || slot.teacher_name?.split(' ')[0]}
                                  </div>
                                )}
                                {entityKey === 'teacher_id' && slot.room_name && (
                                  <div style={{ color: slot.color_text || '#666', opacity: 0.75, fontSize: '0.68rem', marginTop: 2 }}>
                                    {slot.room_name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ color: '#ddd', fontSize: '0.7rem', textAlign: 'center' }}>—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const thDayStyle = {
  background: '#fce8f0',
  color: 'var(--pink-dark)',
  fontWeight: 700,
  fontSize: '0.78rem',
  padding: '8px 12px',
  borderRadius: 6,
  minWidth: 80,
  textAlign: 'center',
};

const thPeriodStyle = {
  background: 'linear-gradient(135deg, var(--pink), var(--orange))',
  color: 'white',
  fontWeight: 700,
  fontSize: '0.8rem',
  padding: '8px 10px',
  borderRadius: 6,
  minWidth: 100,
  textAlign: 'center',
};

const tdDayStyle = {
  background: '#fff0f6',
  border: '2px solid var(--pink-light)',
  borderRadius: 6,
  padding: '10px 12px',
  fontWeight: 700,
  fontSize: '0.82rem',
  color: 'var(--pink-dark)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdDataStyle = {
  padding: '8px 10px',
  textAlign: 'center',
  borderRadius: 8,
  minWidth: 100,
  verticalAlign: 'middle',
  transition: 'filter 0.12s',
};
