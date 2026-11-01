/** One supplied photo-style asset + two generated illustrations; no system patients. */
export const LOGIN_SLIDES = [
  {
    src: '/assets/login/pediatric-consultation.webp',
    alt: 'Ảnh minh họa: bác sĩ cùng trẻ em và phụ huynh xem thông tin sức khỏe.',
    width: 1122, height: 1402,
    title: ['Dữ liệu hôm nay,', 'vì sức khỏe ngày mai'],
    position: '50% 18%',
  },
  {
    src: '/assets/login/parent-child-lounge.webp',
    alt: 'Ảnh minh họa AI: mẹ và con trong không gian chăm sóc sức khỏe.',
    width: 960, height: 1200,
    title: ['Hiểu rõ sức khỏe,', 'đồng hành cùng trẻ em'],
    position: '50% 33%',
  },
  {
    src: '/assets/login/pediatric-clinic.webp',
    alt: 'Ảnh minh họa AI: phòng khám nhi sáng và thân thiện.',
    width: 960, height: 1200,
    title: ['Theo dõi và phân tích,', 'hỗ trợ quyết định'],
    position: '50% 50%',
  },
] as const;

export const LOGIN_SLIDE_INTERVAL_MS = 6500;
