/** Independent legacy-route navigation; the protected Parent UI is unchanged. */
export function ParentVersionNavigation() {
  return <nav aria-label="Phiên bản giao diện phụ huynh" style={{ background: '#fff', borderBottom: '1px solid #e2ece7', padding: '12px 20px', textAlign: 'right', fontSize: 14 }}>
    <a href="/phu-huynh" style={{ color: '#205843', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>Giao diện mới</a>
  </nav>;
}
