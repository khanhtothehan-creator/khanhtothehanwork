/* ===== Linh vật của Khanh: ảnh của bạn, cắt từ tờ sticker ===== */
const STK = {
  avatar: ['assets/img/avatar.webp', 230, 203],
  logo: ['assets/img/logo.webp', 110, 97],
  assistant: ['assets/img/assistant.webp', 197, 200],
  client: ['assets/img/client.webp', 170, 146],
  ads: ['assets/img/ads.webp', 285, 244],
  zh: ['assets/img/zh.webp', 277, 241],
  master: ['assets/img/master.webp', 271, 266],
  marketing: ['assets/img/marketing.webp', 286, 243],
  photo: ['assets/img/photo.webp', 259, 247]
};
const stk = (k, cls, alt) => `<img class="${cls}" src="${STK[k][0]}" width="${STK[k][1]}" height="${STK[k][2]}" alt="${alt || ''}">`;

/* ===== Dữ liệu ví dụ ===== */
const STAGES = ['Mới', 'Đã gửi tư vấn', 'Đang sửa', 'Đã chốt', 'Đang setup', 'Đang chạy', 'Đang tối ưu'];
/* Danh sách khách ban đầu. Khách tạo trên web (nút "+ Tạo thư mục khách") được lưu trong trình duyệt,
   và lưu lên Drive (file khanh-workspace-data.json) khi đã kết nối Google Drive.
   drive = link thư mục Drive của khách, links = link từng thư mục con */
const CLIENTS = [
  { n: 'Shop mẫu A', s: 0, note: 'Brief vừa nhận', goal: 'Tin nhắn', bud: 15000000, from: '2026-11-01', to: '2026-11-30', drive: '', links: {} },
  { n: 'Spa mẫu B', s: 1, note: 'Chờ khách xem tư vấn v1', goal: 'Chuyển đổi', bud: 12000000, from: '2026-11-05', to: '2026-12-05', drive: '', links: {} },
  { n: 'Quán mẫu C', s: 2, note: 'Sửa ngân sách theo ý khách (v2)', goal: 'Nhận diện', bud: 8000000, from: '2026-11-10', to: '2026-11-30', drive: '', links: {} },
  { n: 'Studio mẫu D', s: 4, note: 'Cài Pixel, dựng 3 chiến dịch', goal: 'Chuyển đổi', bud: 25000000, from: '2026-10-15', to: '2026-11-15', drive: '', links: {} },
  { n: 'Shop mẫu E', s: 5, note: 'Tuần 3, ngân sách 20 triệu', goal: 'Tin nhắn', bud: 20000000, from: '2026-10-07', to: '2026-11-07', drive: '', links: {} },
  { n: 'Cửa hàng mẫu F', s: 6, note: 'Tuần 5, thử mẫu video mới', goal: 'Chuyển đổi', bud: 30000000, from: '2026-09-16', to: '2026-11-16', drive: '', links: {} }
];
/* ===== Lưu danh sách khách ===== */
const DATA_KEY = 'kws.data', DATA_FILE = 'khanh-workspace-data.json';
let dataTime = 0;
const setClients = d => { CLIENTS.splice(0, CLIENTS.length, ...d.clients); dataTime = d.t || 0; };
try { const d = JSON.parse(localStorage.getItem(DATA_KEY)); if (d && Array.isArray(d.clients)) setClients(d); } catch (e) { /* dùng danh sách mặc định */ }

/* Agent của mục ads: [tên, việc làm, model mặc định, mã agent ở backend] */
const AGENTS = [
  ['Tiếp nhận', 'Đọc brief, tóm tắt, liệt kê câu cần hỏi lại khách.', 'Gemini', 'tiep_nhan'],
  ['Chiến lược', 'Đề xuất mục tiêu, tệp khách, cấu trúc chiến dịch, ngân sách, KPI.', 'Gemini', 'chien_luoc'],
  ['Nội dung', 'Viết mẫu quảng cáo, ý tưởng hình ảnh/video, mẫu mới khi ads yếu.', 'Gemini', 'noi_dung'],
  ['Tracking', 'Tạo checklist Pixel, sự kiện, UTM theo kênh nhận khách.', 'Gemini', 'tracking'],
  ['Tổng hợp', 'Ghép kết quả thành bản tư vấn và báo giá gửi khách.', 'Gemini', 'tong_hop'],
  ['Báo cáo', 'Đọc số liệu ads, đánh giá và đề xuất tối ưu.', 'Gemini', 'bao_cao'],
  ['Kiểm duyệt', 'Soát báo cáo: số liệu bịa, mâu thuẫn, đề xuất rủi ro.', 'Gemini', 'kiem_duyet']
];
const SCHOOLS = [
  ['政大 NCCU', 'Global Communication and Innovation Technology (GCIT)'],
  ['中國文化大學 PCCU', 'Kỳ xuân 2027'],
  ['高雄科技大學 NKUST', 'Marketing và Quản lý phân phối, đang xin học bổng']
];

/* ===== Danh bạ mục: thêm đảo mới = thêm một dòng ở đây =====
   w = vị trí trên bản đồ (màn rộng), n = vị trí trên bản đồ (điện thoại); mục nào cũng nằm trong cùng một trang */
const MODULES = [
  { id: 'ads', slug: 'ads', name: 'Job chạy ads', title: 'Job chạy ads', sub: 'Từ brief đến theo dõi Meta Ads, mỗi khách một hồ sơ riêng.', desc: ['Từ brief đến báo cáo', 'Meta Ads cho khách'], w: { x: 230, y: 205 }, n: { x: 125, y: 185 }, art: 'ads', badge: CLIENTS.filter(c => c.s <= 2).length },
  { id: 'marketing', slug: 'marketing', name: 'Marketing job', title: 'Marketing job', sub: 'Plan, content, brand và growth cho các job marketing.', desc: ['Plan, content,', 'brand, growth'], w: { x: 440, y: 185 }, n: { x: 355, y: 225 }, art: 'ads', badge: 0 },
  { id: 'photo', slug: 'chup-anh', name: 'Chụp ảnh job', title: 'Chụp ảnh job', sub: 'Lịch chụp, khách và file ảnh của từng job.', desc: ['Lịch chụp, khách', 'và file ảnh từng job'], w: { x: 650, y: 205 }, n: { x: 125, y: 395 }, art: 'ads', badge: 0 },
  { id: 'zh', slug: 'tieng-trung', name: 'Học tiếng Trung', title: 'Học tiếng Trung', sub: 'Từ vựng, ôn tập và TOCFL.', desc: ['Từ vựng, ôn tập', 'và TOCFL'], w: { x: 230, y: 455 }, n: { x: 355, y: 435 }, art: 'zh', badge: 12 },
  { id: 'master', slug: 'thac-si', name: 'Học thạc sĩ', title: 'Học thạc sĩ', sub: 'Các trường, hạn nộp và tiến độ từng hồ sơ.', desc: ['Trường, hạn nộp', 'và tiến độ hồ sơ'], w: { x: 440, y: 475 }, n: { x: 125, y: 605 }, art: 'school', badge: 3 },
  { id: 'assistant', slug: 'tro-ly', name: 'Trợ lý chung', title: 'Trợ lý chung', sub: 'Hỏi gì cũng được, trợ lý chuyển đúng mục.', desc: ['Hỏi gì cũng được', 'tự chuyển đúng mục'], w: { x: 650, y: 455 }, n: { x: 355, y: 645 }, art: 'tower', badge: 0 }
];

/* ===== Hình vẽ các toà nhà (gốc toạ độ = giữa mặt đảo, nhà cao lên phía trên) ===== */
const ART = {
  ads() {
    const n = 6, w = 104 / n; let aw = '';
    for (let i = 0; i < n; i++) {
      const x0 = -52 + i * w, x1 = x0 + w, t0 = -40 + i * (80 / n), t1 = t0 + 80 / n, c = i % 2 ? 'bld' : 'awn';
      aw += `<polygon class="o ${c}" points="${x0},-58 ${x1},-58 ${t1},-80 ${t0},-80"/>`;
      aw += `<path class="o ${c}" d="M${x0},-58 A${w / 2},${w / 2} 0 0 0 ${x1},-58 Z"/>`;
    }
    return `<rect class="o bld" x="-44" y="-58" width="88" height="52" rx="5"/>
      <rect class="o glass" x="-36" y="-46" width="32" height="26" rx="3"/>
      <rect class="awn" x="-31" y="-30" width="6" height="8"/><rect class="awn" x="-22" y="-36" width="6" height="14"/><rect class="awn" x="-13" y="-42" width="6" height="20"/>
      <rect class="o door" x="10" y="-44" width="24" height="38" rx="3"/><circle class="gld" cx="29" cy="-24" r="2.4"/>
      ${aw}
      <line class="ln" x1="-14" y1="-84" x2="-14" y2="-80"/><line class="ln" x1="14" y1="-84" x2="14" y2="-80"/>
      <rect class="o bld" x="-22" y="-108" width="44" height="24" rx="4"/>
      <polyline class="ln" style="stroke:var(--awn);stroke-width:3" points="-16,-91 -8,-96 -1,-92 8,-101 15,-99"/>`;
  },
  zh() {
    return `<rect class="o bld" x="-42" y="-44" width="84" height="38"/>
      <rect class="o glass" x="-31" y="-36" width="14" height="14" rx="2"/><rect class="o glass" x="17" y="-36" width="14" height="14" rx="2"/>
      <rect class="o door" x="-12" y="-38" width="24" height="32" rx="2"/>
      <rect class="o red" x="-45" y="-48" width="7" height="42"/><rect class="o red" x="38" y="-48" width="7" height="42"/>
      <path class="o red" d="M-68,-46 Q-42,-48 -32,-70 L32,-70 Q42,-48 68,-46 Z"/>
      <rect class="o red" x="-22" y="-82" width="44" height="12" rx="3"/>
      <line class="ln" x1="0" y1="-82" x2="0" y2="-91"/><circle class="o gld" cx="0" cy="-93" r="3.4"/>
      <line class="ln" x1="-56" y1="-46" x2="-56" y2="-40"/><ellipse class="o gld" cx="-56" cy="-30" rx="9" ry="11"/><text class="han-t" x="-56" y="-26" text-anchor="middle">學</text>
      <line class="ln" x1="56" y1="-46" x2="56" y2="-40"/><ellipse class="o gld" cx="56" cy="-30" rx="9" ry="11"/><text class="han-t" x="56" y="-26" text-anchor="middle">中</text>`;
  },
  school() {
    return `<rect class="o bld" x="-58" y="-56" width="116" height="50" rx="3"/>
      <rect class="o bld" x="-22" y="-8" width="44" height="6" rx="1"/>
      <polygon class="o blue" points="-66,-56 0,-94 66,-56"/>
      <path class="o wht" d="M-8,-77 V-71 Q0,-66 8,-71 V-77"/>
      <polygon class="o wht" points="0,-86 14,-80 0,-74 -14,-80"/>
      <line class="ln" x1="13" y1="-79" x2="13" y2="-72"/>
      <line class="ln" x1="0" y1="-94" x2="0" y2="-112"/><polygon class="o awn" points="0,-112 17,-107 0,-102"/>
      <rect class="o glass" x="-48" y="-46" width="12" height="18" rx="2"/><rect class="o glass" x="-32" y="-46" width="12" height="18" rx="2"/>
      <rect class="o glass" x="20" y="-46" width="12" height="18" rx="2"/><rect class="o glass" x="36" y="-46" width="12" height="18" rx="2"/>
      <path class="o door" d="M-11,-8 V-28 A11,11 0 0 1 11,-28 V-8 Z"/>`;
  },
  tower() {
    return `<rect class="o bld" x="-27" y="-68" width="54" height="62" rx="8"/>
      <path class="o blue" d="M-31,-68 A31,31 0 0 1 31,-68 Z"/>
      <line class="ln" x1="0" y1="-99" x2="0" y2="-110"/><circle class="o awn" cx="0" cy="-112" r="3.6"/>
      <circle class="o wht" cx="0" cy="-38" r="19"/>
      <polygon class="awn" points="0,-55 4.5,-38 0,-21 -4.5,-38"/>
      <polygon class="blue" points="-17,-38 0,-42.5 17,-38 0,-33.5"/>
      <circle class="inkf" cx="0" cy="-38" r="2.4"/>`;
  },
  locked() {
    return `<path class="dash-b" d="M-44,-6 V-50 L0,-84 L44,-50 V-6 Z"/><text class="q" x="0" y="-30" text-anchor="middle">?</text>`;
  }
};

/* ===== Vẽ làng: tất cả nhà trên một hòn đảo, thấy hết trong một trang ===== */
const LAND = {
  w: { vb: '0 0 880 720', cx: 440, cy: 330, rx: 430, ry: 290,
    rock: 'M10,330 Q20,500 170,600 Q300,665 440,708 Q580,665 710,600 Q860,500 870,330 Z', lines: 'M150,560 Q200,615 250,655 M720,560 Q670,620 620,658' },
  n: { vb: '0 0 480 900', cx: 240, cy: 430, rx: 228, ry: 385,
    rock: 'M12,430 Q18,700 110,805 Q175,865 240,888 Q305,865 370,805 Q462,700 468,430 Z', lines: 'M60,720 Q110,810 170,852 M420,720 Q370,810 310,852' }
};
const ROADS = {
  w: [[230, 211], [440, 191], [650, 211], [715, 335], [650, 461], [440, 481], [230, 461]],
  n: [[125, 191], [240, 215], [355, 231], [240, 320], [125, 401], [240, 420], [355, 441], [240, 530], [125, 611], [240, 630], [355, 651]]
};
let mapMode = null;
const P = m => m[mapMode];

function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const cloud = (x, y, s, c) => `<g class="cl ${c}" transform="translate(${x},${y}) scale(${s})"><circle cx="0" cy="0" r="18"/><circle cx="24" cy="-8" r="24"/><circle cx="52" cy="0" r="18"/><rect x="-18" y="0" width="88" height="18" rx="9"/></g>`;
const coin = (x, y, r) => `<g transform="translate(${x},${y}) rotate(${r})"><ellipse class="coin-o" rx="14" ry="11"/><ellipse class="coin-i" rx="8" ry="6"/></g>`;
const pinShape = (cls, x, y, label) => `<g class="pin ${cls}" transform="translate(${x},${y})"><g class="pb"><path d="M0,0 C-9,-11 -13,-17 -13,-24 a13,13 0 1 1 26,0 C13,-17 9,-11 0,0Z"/>${label ? `<text y="-19.5" text-anchor="middle">${label}</text>` : '<circle cx="0" cy="-24" r="4.5" fill="#fff"/>'}</g></g>`;
const tree = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})"><ellipse class="patch" cx="0" cy="1" rx="17" ry="5" style="stroke-width:1.5"/><rect class="o door" x="-4" y="-18" width="8" height="18"/><circle class="o tr" cx="-11" cy="-24" r="12"/><circle class="o tr" cx="11" cy="-24" r="12"/><circle class="o tr" cx="0" cy="-34" r="15"/></g>`;
const pond = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})"><ellipse class="pond" rx="42" ry="15"/><ellipse class="pond-hi" cx="-10" cy="-3" rx="18" ry="4"/></g>`;
const bloom = (x, y) => `<g transform="translate(${x},${y})"><circle class="fl" cx="0" cy="-3.5" r="3"/><circle class="fl" cx="3.4" cy="-1" r="3"/><circle class="fl" cx="2" cy="3" r="3"/><circle class="fl" cx="-2" cy="3" r="3"/><circle class="fl" cx="-3.4" cy="-1" r="3"/><circle class="fl-c" r="2.2"/></g>`;

function landLayer(mode) {
  const L = LAND[mode];
  return `<path class="rock" d="${L.rock}"/><path class="rk-l" d="${L.lines}"/>
    <ellipse class="isl" cx="${L.cx}" cy="${L.cy}" rx="${L.rx}" ry="${L.ry}"/>
    <ellipse class="isl-hi" cx="${L.cx}" cy="${L.cy - 10}" rx="${L.rx * .93}" ry="${L.ry * .9}"/>`;
}
const patchLayer = m => { const p = P(m); return `<ellipse class="patch${m.locked ? ' lk' : ''}" cx="${p.x}" cy="${p.y + 5}" rx="68" ry="17"/>`; };
const skyFor = mode => (mode === 'w'
  ? [cloud(14, 56, .95, 'c2'), cloud(700, 30, .9, 'c3'), cloud(-6, 560, .85, 'c3'), cloud(775, 585, .8, 'c1')]
  : [cloud(-12, 44, .9, 'c2'), cloud(390, 20, .8, 'c3'), cloud(-16, 780, .85, 'c3'), cloud(392, 775, .8, 'c1')]).join('');
const groundFor = mode => (mode === 'w'
  ? [tree(62, 340, 1), tree(818, 340, 1), tree(95, 520, .85), tree(785, 520, .85), tree(335, 255, .8), tree(545, 255, .8), tree(335, 520, .8), tree(545, 520, .8),
     coin(335, 140, -14), coin(545, 130, 12), coin(440, 340, 10), pond(440, 610, .8), bloom(150, 300), bloom(730, 300), bloom(340, 600), bloom(540, 600), bloom(440, 90)]
  : [tree(30, 310, .8), tree(450, 340, .8), tree(240, 160, .8), tree(240, 390, .8), tree(32, 520, .8), tree(448, 540, .8), tree(240, 560, .8), pond(240, 770, .8),
     coin(240, 280, -12), coin(240, 480, 10), bloom(210, 120), bloom(60, 420), bloom(430, 450), bloom(110, 760), bloom(370, 760)]).join('');

function stickerArt(m, compact) {
  const k = STK[m.id]; if (!k) return ART[m.art]();
  const h = compact ? 104 : 122, w = Math.min(158, Math.round(h * k[1] / k[2])), hh = Math.round(w * k[2] / k[1]);
  return `<image href="${k[0]}" x="${-w / 2}" y="${-hh - 2}" width="${w}" height="${hh}"/>`;
}
function topLayer(m) {
  const p = P(m), W = 170, compact = mapMode === 'n', H = compact ? 64 : 82;
  const pillText = m.locked ? 'Sắp mở' : (m.badge ? `${m.badge} việc đang chờ` : 'Sẵn sàng');
  const pw = Math.round(pillText.length * 7 + 26);
  const label = m.locked ? 'Đất trống, sắp xây' : `${m.title}${m.badge ? `, ${m.badge} việc đang chờ` : ''}`;
  const pin = m.badge ? pinShape('', 74, -100, m.badge) : '';
  const mas = '';
  const desc = compact
    ? `<text class="cs" x="${W / 2}" y="56" text-anchor="middle">${m.desc[0]}</text>`
    : `<text class="cs" x="${W / 2}" y="56" text-anchor="middle">${m.desc[0]}</text><text class="cs" x="${W / 2}" y="71" text-anchor="middle">${m.desc[1]}</text>`;
  const card = `<g class="card" transform="translate(${-W / 2},34)">
    <rect class="cd" width="${W}" height="${H}" rx="18"/>
    <circle class="hole" cx="11" cy="11" r="3.6"/><circle class="hole" cx="${W - 11}" cy="11" r="3.6"/>
    <circle class="hole" cx="11" cy="${H - 11}" r="3.6"/><circle class="hole" cx="${W - 11}" cy="${H - 11}" r="3.6"/>
    <rect class="pl" x="${(W - pw) / 2}" y="-12" width="${pw}" height="24" rx="12"/>
    <text class="pt" x="${W / 2}" y="4.5" text-anchor="middle">${pillText}</text>
    <text class="ct" x="${W / 2}" y="38" text-anchor="middle">${m.name}</text>${desc}</g>`;
  return `<g class="st${m.locked ? ' locked' : ''}" data-id="${m.id}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="${label}">
    <rect x="-82" y="-126" width="164" height="${160 + H}" fill="transparent"/>
    <g class="bg">${stickerArt(m, compact)}</g>${mas}${pin}${card}</g>`;
}
function renderMap() {
  const mode = window.matchMedia('(min-width: 1040px)').matches ? 'w' : 'n';
  if (mode === mapMode) return;
  mapMode = mode;
  const roadD = smooth(ROADS[mode]);
  const svg = document.getElementById('map');
  svg.setAttribute('viewBox', LAND[mode].vb);
  svg.innerHTML = `${skyFor(mode)}${landLayer(mode)}${groundFor(mode)}${MODULES.map(patchLayer).join('')}
    <path class="rd-edge" d="${roadD}"/><path class="rd" d="${roadD}"/>${MODULES.map(topLayer).join('')}`;
}
window.matchMedia('(min-width: 1040px)').addEventListener('change', renderMap);

/* ===== Biểu tượng nhỏ cho tab và nút nhanh ===== */
const ICON = {
  home: '<path d="M3 11 12 4l9 7v9H3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  ads: '<path d="M5 20V12M12 20V5M19 20v-9" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  zh: '<text x="12" y="18.5" text-anchor="middle" font-size="18" font-weight="800" fill="currentColor" font-family="var(--font-han)">學</text>',
  master: '<path d="M2 9l10-5 10 5-10 5z" fill="currentColor"/><path d="M6 12v5c3 3 9 3 12 0v-5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  marketing: '<path d="M4 10v4h3l7 4V6L7 10z" fill="currentColor"/><path d="M17 9c1.5 1 1.5 5 0 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  photo: '<path d="M3 8h4l2-3h6l2 3h4v11H3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  assistant: '<path d="M4 5h16v11H11l-5 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>'
};
const ico = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg>`;
const flower = () => `<svg viewBox="0 0 20 20"><g fill="var(--pink)" stroke="var(--pink-ink)" stroke-width="1"><circle cx="10" cy="4.5" r="3.4"/><circle cx="15.4" cy="8.6" r="3.4"/><circle cx="13.3" cy="15" r="3.4"/><circle cx="6.7" cy="15" r="3.4"/><circle cx="4.6" cy="8.6" r="3.4"/></g><circle cx="10" cy="10.5" r="2.6" fill="var(--gold)"/></svg>`;

/* ===== Trang từng mục ===== */
const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
const VIEWS = {
  ads() {
    const folders = CLIENTS.map((c, i) => `<button type="button" class="fd" data-client="${i}"><b>${esc(c.n)}</b><span>${esc(c.note || '')}</span><span class="pill ${c.s >= 5 ? 'on' : ''}">${STAGES[c.s]}</span>${link(c.drive) ? '<span class="dlink">🔗 Có link Drive</span>' : ''}</button>`).join('')
      + '<button type="button" class="fd add" id="newCl"><b>+ Tạo thư mục khách</b><span>Thêm khách mới và dán link Drive</span></button>';
    const stageOpts = STAGES.map((t, k) => `<option value="${k}">${t}</option>`).join('');
    const dm = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '?';
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const left = c => { const d = Math.round((new Date(c.to) - t0) / 864e5); return d < 0 ? 'đã kết thúc' : `còn ${d} ngày`; };
    const calRows = CLIENTS.map(c => `<tr><td><b>${esc(c.n)}</b></td><td>${esc(c.goal || '')}</td><td class="num">${fmt(c.bud)}</td><td>${dm(c.from)} - ${dm(c.to)} <span class="hint-i">(${c.s < 3 ? 'chưa bắt đầu' : c.to ? left(c) : 'chưa có ngày'})</span></td></tr>`).join('');
    const clOpts = `<option value="">Khách mới (chưa có thư mục)</option>` + CLIENTS.map((c, i) => `<option value="${i}"${SEL.consultCl === String(i) ? ' selected' : ''}>${esc(c.n)}</option>`).join('');
    const allAds = CLIENTS.flatMap((c, ci) => (c.ads || []).map((a, ai) => adRow(ci, ai, true))).join('');
    return `
    <div class="block"><h3>Khách hàng</h3><p class="hint">Mỗi khách một thư mục riêng. Bấm vào thư mục để mở hồ sơ của khách đó.</p>
      <div class="seg" role="group" aria-label="Chế độ xem"><button type="button" data-tab="all" aria-pressed="true">Tất cả</button><button type="button" data-tab="cal" aria-pressed="false">Check lịch</button></div>
      <div id="tab-all" class="fgrid">${folders}</div>
      <form id="clForm" class="clform" hidden>
        <h4>Tạo thư mục khách mới</h4>
        <label>Tên khách *<input type="text" name="n" required maxlength="80" placeholder="VD: Shop Hoa Mai"></label>
        <label>Link thư mục Drive của khách<input type="url" name="drive" placeholder="https://drive.google.com/drive/folders/..."></label>
        <label>Ghi chú<input type="text" name="note" maxlength="120" placeholder="VD: Brief vừa nhận"></label>
        <div class="two">
          <label>Giai đoạn<select name="s">${stageOpts}</select></label>
          <label>Mục tiêu<select name="goal"><option>Tin nhắn</option><option>Chuyển đổi</option><option>Nhận diện</option><option>Lượt truy cập</option><option>Khác</option></select></label>
        </div>
        <label>Ngân sách (đ/tháng)<input type="number" name="bud" min="0" step="1000000" value="0"></label>
        <div class="two">
          <label>Từ ngày<input type="date" name="from"></label>
          <label>Đến ngày<input type="date" name="to"></label>
        </div>
        <div class="row"><button class="btn" type="submit">Tạo thư mục</button><button class="crumb" type="button" id="clCancel">Huỷ</button></div>
      </form>
      <div id="tab-cal" class="tablewrap" hidden><table><thead><tr><th>Tên</th><th>Mục tiêu</th><th class="num">Ngân sách</th><th>Thời gian thực hiện</th></tr></thead><tbody>${calRows}</tbody></table></div></div>
    <div class="block"><h3>Phân tích brief với AI<span class="tag">AI agent</span></h3><p class="hint">Dán brief của khách, AI phân tích và viết bản tư vấn kèm báo giá. File Google Docs được lưu vào thư mục 02_Tu-van của khách (hoặc thư mục Drive của khách) và ghi vào Google Sheet.</p>
      <div class="intake">
        <label for="consultCl">Khách</label>
        <select id="consultCl" data-mk="consultCl">${clOpts}</select>
        <label for="brief">Brief + yêu cầu của khách</label>
        <textarea id="brief" rows="6" placeholder="Dán brief của khách vào đây: sản phẩm, mục tiêu, ngân sách, thời gian, khu vực, khách hàng mục tiêu...">${esc(SEL.brief || '')}</textarea>
        <label for="mode">Cách chạy</label>
        <select id="mode" data-mk="mode"><option value="multi"${SEL.mode !== 'fast' ? ' selected' : ''}>Đa tác tử: 5 agent phối hợp (kỹ hơn, 1-3 phút)</option><option value="fast"${SEL.mode === 'fast' ? ' selected' : ''}>Nhanh: 1 agent (khoảng 30 giây)</option></select>
        <div class="row"><button type="button" class="btn" id="sum">Gửi AI phân tích</button><button type="button" class="crumb" id="aiSet">Cài đặt AI</button></div>
        <div id="sumOut" hidden></div>
      </div></div>
    <div class="block"><h3>Sổ ads Meta</h3><p class="hint">Tất cả ads của các khách. Bấm tên ads để mở trên Meta, bấm <b>Phân tích</b> để AI tạo file phân tích và cập nhật Google Sheet. Thêm ads trong hồ sơ từng khách.</p>
      <div class="adlist">${allAds || '<p class="hint">Chưa có ads nào. Mở hồ sơ một khách và bấm "+ Thêm ads".</p>'}</div></div>
    <div class="block"><h3>Tính phí quản lý</h3><p class="hint">Phí của bạn là 10-20% ngân sách ads của khách.</p>
      <div class="calc">
        <label for="bud">Ngân sách ads của khách (đ/tháng)</label>
        <input type="number" id="bud" min="0" step="1000000" value="20000000">
        <label for="pct">Mức phí: <span id="pctv">15</span>%</label>
        <input type="range" id="pct" min="10" max="20" step="1" value="15">
        <p class="out">Phí: <span id="fee"></span></p>
      </div></div>
    ${agentsBlock('ag', AGENTS, 'Chế độ đa tác tử: Tiếp nhận → Chiến lược → Nội dung + Tracking (song song) → Tổng hợp. Phân tích ads: Báo cáo → Nội dung + Kiểm duyệt. Chọn model cho từng agent; Claude cần khoá CLAUDE_API_KEY, chưa có thì tự dùng Gemini.')}`;
  },
  zh() {
    return `
    <div class="tiles">
      <div class="tile"><b>12</b><span>từ cần ôn hôm nay</span></div>
      <div class="tile"><b>Marketing</b><span>bộ từ vựng ngành</span></div>
      <div class="tile"><b>TOCFL</b><span>đề và bài luyện</span></div>
    </div>
    <div class="block"><h3>Thẻ từ mẫu<span class="tag">ví dụ</span></h3><p class="hint">Agent từ vựng sẽ tạo thẻ theo khuôn này khi bạn gửi một từ.</p>
      <article class="vocab">
        <div class="vhead"><span class="big">廣告</span><span class="alt">广告 <small>giản thể</small></span></div>
        <p class="py">guǎnggào · danh từ</p>
        <p class="mean">Quảng cáo</p>
        <dl>
          <dt>Cấu tạo chữ phồn thể</dt><dd><span class="han">廣</span> = <span class="han">广</span> (mái nhà) + <span class="han">黃</span> (vàng) · <span class="han">告</span> = <span class="han">牛</span> (bò) + <span class="han">口</span> (miệng)</dd>
          <dt>Đồng nghĩa</dt><dd><span class="han">宣傳</span> xuānchuán (quảng bá, tuyên truyền)</dd>
          <dt>Trái nghĩa</dt><dd>Không có cặp trái nghĩa rõ ràng</dd>
          <dt>Cụm hay gặp</dt><dd><span class="han">打廣告</span> dǎ guǎnggào (chạy quảng cáo) · <span class="han">廣告費</span> guǎnggào fèi (chi phí quảng cáo) · <span class="han">廣告商</span> guǎnggào shāng (nhà quảng cáo)</dd>
        </dl>
      </article></div>`;
  },
  master() {
    const rows = SCHOOLS.map((s, i) => `<div class="school"><div><b class="han">${s[0]}</b><p>${s[1]}</p></div>
      <div class="ctl"><label class="sr" for="dl${i}">Hạn nộp ${s[0]}</label><input type="date" id="dl${i}">
      <label class="sr" for="st${i}">Tiến độ ${s[0]}</label><select id="st${i}"><option>Chưa bắt đầu</option><option>Đang soạn</option><option>Đã nộp</option></select></div></div>`).join('');
    return `<div class="block"><h3>Các trường đang nộp</h3><p class="hint">Nhập hạn nộp để trang chủ đếm ngược và nhắc trước.</p><div class="schools">${rows}</div></div>`;
  },
  assistant() {
    return `<div class="block"><h3>Hỏi bất cứ gì</h3><p class="hint">Trợ lý đọc câu hỏi rồi chuyển đến đúng mục. Mục này mở sau cùng, khi đã có 2-3 mục chạy ổn.</p>
      <div class="chat"><div class="row"><label class="sr" for="ask">Câu hỏi</label><input type="text" id="ask" placeholder="Ví dụ: tuần này khách nào cần báo cáo?" disabled><button type="button" disabled>Gửi</button></div>
      <div class="route"><div>"Báo cáo tuần của Shop mẫu E" <span>→ Ads cho khách</span></div><div>"Giải nghĩa từ 行銷" <span>→ Tiếng Trung</span></div><div>"Hạn nộp trường nào gần nhất?" <span>→ Hồ sơ thạc sĩ</span></div></div></div></div>`;
  }
};

/* ===== Chọn model cho agent ở mọi mục ===== */
const SEL = (() => { try { return JSON.parse(localStorage.getItem('kws.sel')) || {}; } catch (e) { return {}; } })();
const saveSel = () => { try { const o = {}; Object.keys(SEL).filter(k => /^(ag\d|mode)/.test(k)).forEach(k => { o[k] = SEL[k]; }); localStorage.setItem('kws.sel', JSON.stringify(o)); } catch (e) { /* bỏ qua */ } };
// Model người dùng chọn cho một agent (ô chọn ở khung "Các agent của mục này")
const agentModel = key => { const i = AGENTS.findIndex(a => a[3] === key.replace(/_ads$/, '')); return (SEL['ag' + i] || (AGENTS[i] && AGENTS[i][2]) || 'Gemini').toLowerCase(); };
function agentsBlock(key, list, hint) {
  const cards = list.map((a, i) => {
    const id = key + i, cur = SEL[id] || a[2] || 'Gemini';
    const opts = ['Gemini', 'Claude'].map(m => `<option${m === cur ? ' selected' : ''}>${m}</option>`).join('');
    return `<div class="agent"><b>${a[0]}</b><span>${a[1]}</span><label class="sr" for="${id}">Model của agent ${a[0]}</label><select id="${id}" data-mk="${id}">${opts}</select></div>`;
  }).join('');
  return `<div class="block"><h3>Các agent của mục này<span class="tag">chọn model cho từng agent</span></h3><p class="hint">${hint}</p><div class="agents">${cards}</div></div>`;
}
const MODAGENTS = {
  zh: [['Giải nghĩa từ', 'Nhận từ bạn gửi, trả thẻ đủ nghĩa, pinyin, tách chữ, đồng nghĩa, trái nghĩa, cụm.'], ['Ôn tập', 'Tạo bài ôn và đề luyện TOCFL từ các từ đã học.']],
  master: [['Soạn hồ sơ', 'Giúp viết và sửa tự truyện, kế hoạch học tập theo từng trường.'], ['Nhắc hạn nộp', 'Theo dõi hạn nộp và việc còn thiếu của từng trường.']],
  marketing: [['Lập kế hoạch', 'Đề xuất plan, lịch nội dung và mục tiêu.'], ['Viết nội dung', 'Viết bài, caption và ý tưởng cho brand.'], ['Báo cáo tăng trưởng', 'Đọc số liệu và viết nhận xét.']],
  photo: [['Sắp lịch chụp', 'Gom lịch, địa điểm và yêu cầu của khách.'], ['Chọn và chỉnh ảnh', 'Gợi ý ảnh nên chọn và ghi chú chỉnh sửa.']],
  assistant: [['Điều phối', 'Đọc câu hỏi rồi chuyển đúng mục và đúng agent.']]
};
VIEWS.marketing = () => `
  <div class="tiles"><div class="tile"><b>Plan</b><span>kế hoạch và mục tiêu</span></div><div class="tile"><b>Content</b><span>ý tưởng, bài viết, lịch đăng</span></div><div class="tile"><b>Brand</b><span>giọng điệu, hình ảnh</span></div><div class="tile"><b>Growth</b><span>số liệu và tăng trưởng</span></div></div>
  <div class="block"><h3>Việc marketing đang theo<span class="tag">ví dụ</span></h3><p class="hint">Mỗi job marketing một thư mục riêng, theo bốn nhóm Plan, Content, Brand, Growth.</p>
    <div class="tablewrap"><table><thead><tr><th>Job</th><th>Nhóm</th><th>Trạng thái</th></tr></thead><tbody><tr><td><b>Job mẫu 1</b></td><td>Plan</td><td><span class="pill">Đang soạn</span></td></tr><tr><td><b>Job mẫu 2</b></td><td>Content</td><td><span class="pill on">Đang chạy</span></td></tr></tbody></table></div></div>`;
VIEWS.photo = () => `
  <div class="tiles"><div class="tile"><b>2</b><span>buổi chụp tuần này</span></div><div class="tile"><b>1</b><span>bộ ảnh chờ chỉnh</span></div><div class="tile"><b>1</b><span>bộ ảnh chờ giao</span></div></div>
  <div class="block"><h3>Lịch chụp<span class="tag">ví dụ</span></h3><p class="hint">Mỗi job chụp một thư mục: yêu cầu, lịch, ảnh gốc, ảnh đã chỉnh.</p>
    <div class="tablewrap"><table><thead><tr><th>Job</th><th>Ngày chụp</th><th>Trạng thái</th></tr></thead><tbody><tr><td><b>Job mẫu A</b></td><td>Thứ Bảy</td><td><span class="pill">Chờ chụp</span></td></tr><tr><td><b>Job mẫu B</b></td><td>Tuần trước</td><td><span class="pill on">Đang chỉnh ảnh</span></td></tr></tbody></table></div></div>`;
['zh', 'master', 'assistant', 'marketing', 'photo'].forEach(k => {
  const f = VIEWS[k];
  VIEWS[k] = () => f() + agentsBlock(k, MODAGENTS[k], 'Mỗi mục có agent riêng, bạn chọn model cho từng agent.');
});

/* ===== Hồ sơ riêng từng khách ===== */
const FOLDERS = [
  ['00_Thong-tin', 'Hợp đồng, liên hệ, ghi chú quyền tài khoản ads', 'Chỉ bạn', 'Không agent nào'],
  ['01_Brief', 'Brief và yêu cầu của khách', 'Agent Tiếp nhận', 'Agent Chiến lược'],
  ['02_Tu-van', 'Tư vấn v1, v2... và bảng giá', 'Agent Chiến lược, bạn duyệt', 'Bạn, khách (bản đã duyệt)'],
  ['03_Ke-hoach-setup', 'Kế hoạch chi tiết, cấu trúc chiến dịch', 'Agent Chiến lược, Tracking', 'Agent Nội dung'],
  ['04_So-ads-Meta', 'Danh sách ads, ô tick đã chạy', 'Bạn, agent Nội dung', 'Agent Tracking, Báo cáo'],
  ['05_Bao-cao', 'Báo cáo tuần kèm nhận xét', 'Agent Báo cáo', 'Bạn, khách (bản đã duyệt)'],
  ['06_Nhat-ky-toi-uu', 'Đổi gì, ngày nào, kết quả ra sao', 'Bạn, agent Báo cáo', 'Agent Báo cáo']
];
/* ===== Ads Meta: một dòng ads (dùng ở Sổ ads và hồ sơ khách) ===== */
const VERDICT = { 'Tốt': 'on', 'Ổn': 'on', 'Cần tối ưu': '', 'Kém': 'bad', 'Chưa đủ dữ liệu': '' };
function adRow(ci, ai, showClient) {
  const c = CLIENTS[ci], a = c.ads[ai], L = a.last, id = ci + ':' + ai;
  return `<div class="adrow">
    <div class="adh">${showClient ? `<span class="pill">${esc(c.n)}</span>` : ''}
      <a class="adname" href="${link(a.url)}" target="_blank" rel="noopener">${esc(a.name || 'Ads ' + (a.url.match(/\d{6,}/) || [''])[0])} ↗</a>
      <button type="button" class="btn sm" data-analyze="${id}">Phân tích</button>
      ${showClient ? '' : `<button type="button" class="crumb sm danger" data-addel="${ai}" aria-label="Xoá ads">Xoá</button>`}</div>
    ${L ? `<div class="adres"><span class="pill ${VERDICT[L.danh_gia] || ''}">${esc(L.danh_gia)}</span> <span>${esc(L.tom_tat)}</span>
      <span class="hint-i">${esc(L.t)} · <a href="${link(L.doc)}" target="_blank" rel="noopener">File phân tích ↗</a>${L.sheet ? ` · <a href="${link(L.sheet)}" target="_blank" rel="noopener">Google Sheet ↗</a>` : ''}</span></div>` : ''}
    ${showClient ? '' : `<details class="admore"><summary>Số liệu dán tay và ghi chú (khi chưa nối Meta)</summary>
      <textarea rows="3" data-admet="${ai}" placeholder="Dán số liệu từ Ads Manager: chi tiêu, hiển thị, CTR, CPM, kết quả, chi phí/kết quả...">${esc(a.metrics || '')}</textarea>
      <textarea rows="2" data-adnote="${ai}" placeholder="Ghi chú cho AI, VD: khách muốn giảm chi phí tin nhắn">${esc(a.note || '')}</textarea></details>`}
    <div class="adout" id="adout-${ci}-${ai}" hidden></div></div>`;
}

// Markdown đơn giản từ Claude → HTML (đã escape)
function md(t) {
  const inline = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let h = '', list = '';
  const close = () => { if (list) { h += `</${list}>`; list = ''; } };
  String(t).split('\n').forEach(line => {
    const l = line.trim(); let m;
    if (!l) { close(); return; }
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); h += `<h4>${inline(m[1])}</h4>`; }
    else if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); h += '<ul>'; list = 'ul'; } h += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); h += '<ol>'; list = 'ol'; } h += `<li>${inline(m[1])}</li>`; }
    else { close(); h += `<p>${inline(l)}</p>`; }
  });
  close();
  return h;
}

VIEWS.client = function (i) {
  const c = CLIENTS[i], s = c.s;
  const lk = f => link(c.links && c.links[f]);
  const rows = FOLDERS.map((f, k) => `<div class="folder"><div class="fh"><b class="mono">${f[0]}</b><span class="pill ${lk(f[0]) ? 'on' : ''}" id="fp${k}">${lk(f[0]) ? 'Đã gắn link' : 'Chưa gắn link'}</span><a class="pill on" id="fl${k}" target="_blank" rel="noopener"${lk(f[0]) ? ` href="${lk(f[0])}"` : ' hidden'}>Mở Drive ↗</a>${f[3].includes('khách') ? '<span class="pill on">Gửi được cho khách</span>' : ''}</div>
    <p>${f[1]}</p><dl><div><dt>Ghi</dt><dd>${f[2]}</dd></div><div><dt>Đọc</dt><dd>${f[3]}</dd></div></dl>
    <input class="flink" type="url" data-flink="${f[0]}" value="${esc(lk(f[0]))}" placeholder="Dán link thư mục ${f[0]} (không bắt buộc)" aria-label="Link Drive của ${f[0]}"></div>`).join('');
  const stageOpts = STAGES.map((t, k) => `<option value="${k}"${k === s ? ' selected' : ''}>${t}</option>`).join('');
  const review = s >= 5 ? `<div class="block"><h3>Nhận xét của agent Báo cáo<span class="tag">ví dụ</span></h3>
    <div class="review"><span class="pill">Bản nháp, chờ bạn duyệt</span>
      <p>Agent đọc số liệu tuần trong <span class="mono">04_So-ads-Meta</span> rồi viết nhận xét vào <span class="mono">05_Bao-cao</span>:</p>
      <ul><li>Mẫu Video01 đang cho chi phí mỗi tin nhắn tốt hơn Ảnh02.</li><li>Nhóm Lookalike còn trong giai đoạn học, chưa nên chỉnh lớn.</li><li>Đề xuất: tăng nhẹ ngân sách Video01, giữ nguyên Ảnh02 thêm 3 ngày rồi xem lại.</li></ul>
      <p class="hint">Bạn sửa và duyệt xong mới gửi cho khách. Mọi thay đổi ghi vào <span class="mono">06_Nhat-ky-toi-uu</span>.</p></div></div>` : '';
  const n = esc(c.n);
  return `<div class="iso"><b>Thư mục Drive của ${n}</b>
      ${link(c.drive) ? `<div class="drvact"><a class="btn" href="${link(c.drive)}" target="_blank" rel="noopener">Mở thư mục Drive của ${n} ↗</a></div>
      <a class="dl" href="${link(c.drive)}" target="_blank" rel="noopener">${esc(c.drive)}</a>` : `<p>Chưa có link. Tạo thư mục cho khách trên Google Drive, copy link rồi dán vào ô dưới.</p>`}
      <div class="row"><input type="url" id="clDrive" value="${esc(link(c.drive))}" placeholder="https://drive.google.com/drive/folders/..." aria-label="Link thư mục Drive của ${n}"><button class="btn" type="button" id="clDriveSave">${link(c.drive) ? 'Lưu link mới' : 'Lưu link'}</button></div>
      <p id="drvStat" class="hint">${driveStatus(c)}</p>
      ${Drive.configured() ? `<div class="drvact"><button class="btn" type="button" id="drvSync" data-sync="${i}">${Drive.connected() ? 'Đồng bộ thư mục Drive' : 'Kết nối và tạo thư mục trên Drive'}</button></div>` : ''}</div>
    <div class="block"><h3>Ads Meta của ${n}</h3><p class="hint">Dán link ads từ Ads Manager. Bấm tên ads để mở ads đó, bấm <b>Phân tích</b> để AI tự tạo file phân tích (lưu vào 05_Bao-cao) và cập nhật Google Sheet.</p>
      <div class="adlist">${(c.ads || []).map((a, ai) => adRow(i, ai, false)).join('') || '<p class="hint">Chưa có ads nào.</p>'}</div>
      <form id="adForm" class="clform">
        <h4>+ Thêm ads</h4>
        <div class="two"><label>Tên ads<input type="text" name="name" maxlength="120" placeholder="VD: ShopA_Mess_Broad_Video01"></label>
        <label>Link ads (Ads Manager)<input type="url" name="url" required placeholder="https://adsmanager.facebook.com/...selected_ad_ids=..."></label></div>
        <div class="row"><button class="btn" type="submit">Thêm ads</button></div>
      </form></div>
    ${(c.docs || []).length ? `<div class="block"><h3>Tài liệu AI đã tạo</h3><ul class="docs">${c.docs.slice(0, 20).map(d => `<li><span class="hint-i">${esc(d.t)}</span> <a href="${link(d.url)}" target="_blank" rel="noopener">${esc(d.title)} ↗</a></li>`).join('')}</ul></div>` : ''}
    <div class="iso"><b>Thông tin khách</b>
      <div class="two"><label>Giai đoạn<select id="clStage">${stageOpts}</select></label><label>Ghi chú<input type="text" id="clNote" value="${esc(c.note || '')}" maxlength="120"></label></div>
      <p class="hint">Agent làm việc cho ${n} chỉ đọc và ghi trong 7 thư mục dưới đây. Dữ liệu của khách khác không lẫn vào.</p>
      <div class="row"><button class="crumb danger" type="button" id="clDel">Xoá khách này khỏi web</button></div></div>
    <div class="block"><h3>Thư mục của ${n}</h3><p class="hint">Mỗi thư mục ghi rõ ai được ghi và ai được đọc. Dán link thư mục con vào ô cuối mỗi thẻ, link tự lưu.</p><div class="folders">${rows}</div></div>${review}`;
};

/* ===== Điều hướng kiểu trình duyệt: lùi, tiến, tải lại, thanh địa chỉ ===== */
const $ = id => document.getElementById(id);
const BASE = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hist = []; let hi = -1, cur = { m: null, c: null }, tm;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(tm); tm = setTimeout(() => { el.hidden = true; }, 2800); }

function render(v, focus) {
  if (v.c != null && !CLIENTS[v.c]) v = { m: 'ads', c: null };
  cur = v;
  const home = !v.m, m = MODULES.find(x => x.id === v.m);
  $('homeView').hidden = !home; $('modView').hidden = home;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.go === (v.m || 'home'))));
  const route = home ? '' : m.slug + (v.c != null ? '/' + slugify(CLIENTS[v.c].n) : '');
  $('url').textContent = BASE + '/' + (route ? '#/' + route : '');
  if (location.hash.replace(/^#\/?/, '') !== route) history.replaceState(null, '', route ? '#/' + route : location.pathname);
  if (!home) {
    if (v.c != null) {
      $('modTitle').textContent = CLIENTS[v.c].n; $('modSub').textContent = 'Hồ sơ riêng, giai đoạn: ' + STAGES[CLIENTS[v.c].s] + (CLIENTS[v.c].goal ? ' · Mục tiêu: ' + CLIENTS[v.c].goal : '');
      $('modBody').innerHTML = VIEWS.client(v.c); $('crumb').textContent = '← Danh sách khách';
      if (Drive.connected()) syncClient(v.c, false);
    } else {
      $('modTitle').textContent = m.title; $('modSub').textContent = m.sub;
      $('modBody').innerHTML = VIEWS[m.id](); $('crumb').textContent = '← Về bản đồ';
      if (m.id === 'ads') calc();
    }
  }
  $('modImg').innerHTML = home ? '' : stk(v.c != null ? 'client' : (STK[v.m] ? v.m : 'assistant'), 'mst');
  $('nBack').disabled = hi <= 0; $('nFwd').disabled = hi >= hist.length - 1;
  if (focus !== false) { window.scrollTo(0, 0); (home ? $('tabbar').querySelector('[aria-selected="true"]') : $('modTitle')).focus({ preventScroll: true }); }
}
function go(v) {
  if (v.m) { const m = MODULES.find(x => x.id === v.m); if (m && m.locked) { toast('Mục này chưa mở.'); return; } }
  hist.splice(hi + 1); hist.push(v); hi = hist.length - 1; render(v);
}
const goBack = () => { if (hi > 0) { hi--; render(hist[hi]); } };
const goFwd = () => { if (hi < hist.length - 1) { hi++; render(hist[hi]); } };

/* ===== Dựng khung trang ===== */
const now = new Date();
const dow = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][now.getDay()];
const total = MODULES.reduce((s, m) => s + m.badge, 0);
const waiting = CLIENTS.filter(c => c.s <= 2).length, unsent = SCHOOLS.length;
const open = MODULES.filter(m => !m.locked);

$('tabbar').innerHTML = `<span class="logo" aria-hidden="true">${stk('logo', 'lg')}</span>` +
  [{ id: 'home', name: 'Trang chủ' }, ...open.map(m => ({ id: m.id, name: m.name }))]
    .map(t => `<button class="tab" role="tab" type="button" data-go="${t.id}" aria-selected="false">${ico(t.id)}<span>${t.name}</span></button>`).join('');
$('qgrid').innerHTML = open.map(m => `<button class="qb q-${m.id}" type="button" data-go="${m.id}" aria-label="${m.title}">${ico(m.id)}<span>${m.name}</span></button>`).join('');
$('flw').innerHTML = Array.from({ length: 12 }, flower).join('');
$('avatar').innerHTML = stk('avatar', 'av', 'Linh vật của Khanh');
$('sToday').textContent = `${dow}, ${now.getDate()}/${now.getMonth() + 1}`;
$('sOpen').textContent = `${open.length} mục`;
$('sPend').textContent = total;
$('notes').innerHTML = [
  ['chờ:', `${waiting} khách đang chờ bạn (mới, đã gửi tư vấn, đang sửa).`],
  ['ôn:', '12 từ tiếng Trung cần ôn hôm nay.'],
  ['hạn:', `${unsent} hồ sơ thạc sĩ chưa nhập hạn nộp.`],
  ['drive:', '<span id="drvNote"></span>']
].map(r => `<div class="nrow"><b class="lab">${r[0]}</b><span>${r[1]}</span></div>`).join('');

/* ===== Tương tác ===== */
function calc() {
  const b = $('bud'), p = $('pct'); if (!b || !p) return;
  $('pctv').textContent = p.value; $('fee').textContent = fmt(Math.round((+b.value || 0) * p.value / 100));
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function setTab(t) {
  $('tab-all').hidden = t !== 'all'; $('tab-cal').hidden = t !== 'cal';
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === t)));
}
const wait = (btn, on, label) => { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.l = btn.textContent; btn.textContent = label; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; };
const folderOf = (c, sub) => c ? link(c.links && c.links[sub]) || link(c.drive) : '';

/* ===== Đa tác tử: website điều phối, mỗi bước gọi một agent ở backend ===== */
const STEP_ICON = { wait: '○', run: '◔', done: '✓', fail: '✕' };
// Vẽ danh sách bước, trả về hàm cập nhật trạng thái từng bước
function pipeline(el, steps) {
  el.hidden = false;
  el.innerHTML = `<ol class="pipe">${steps.map(s => `<li id="ps-${s.id}" class="wait"><span class="pi">${STEP_ICON.wait}</span><b>${s.label}</b> <span class="hint-i">${s.desc}</span><div class="po"></div></li>`).join('')}</ol><div class="pfinal"></div>`;
  return (id, state, html) => {
    const li = el.querySelector('#ps-' + id); if (!li) return;
    li.className = state; li.querySelector('.pi').textContent = STEP_ICON[state];
    if (html !== undefined) li.querySelector('.po').innerHTML = html;
  };
}
const detailsOf = (title, body) => `<details><summary>${title}</summary><div class="mdout">${body}</div></details>`;
// Gọi một agent; ghi lại kết quả để chạy lại không phải làm lại bước đã xong
async function agentStep(set, cache, id, agent, input) {
  if (cache[id] !== undefined) { set(id, 'done', detailsOf('Xem kết quả (đã có từ lần trước)', fmtOut(cache[id]))); return cache[id]; }
  set(id, 'run', '<span class="hint-i">đang làm...</span>');
  try {
    const d = await AI.call('agent', { agent, provider: agentModel(agent), input });
    cache[id] = d.output;
    set(id, 'done', detailsOf(`Xem kết quả (${d.provider})`, fmtOut(d.output)));
    return d.output;
  } catch (err) { set(id, 'fail', `<span class="hint-i">${esc(err.message)}</span>`); throw err; }
}
const fmtOut = o => typeof o === 'string' ? md(o) : o.bao_cao_markdown !== undefined && o.danh_gia ? `<p><b>${esc(o.danh_gia)}</b>: ${esc(o.tom_tat)}</p>` + md(o.bao_cao_markdown)
  : o.van_de ? (o.dat ? '<p>Đạt, không phát hiện vấn đề.</p>' : `<ul>${o.van_de.map(v => `<li>${esc(v)}</li>`).join('')}</ul>`) : `<pre>${esc(JSON.stringify(o, null, 1))}</pre>`;
const RUNS = {}; // kết quả từng bước theo brief/ads, để chạy tiếp khi lỗi giữa chừng

async function summarizeMulti(c, brief, outEl) {
  const key = 'b|' + (c ? c.n : '') + '|' + brief, cache = RUNS[key] = RUNS[key] || {};
  const set = pipeline(outEl, [
    { id: 'tn', label: '① Tiếp nhận', desc: 'tóm tắt brief, câu cần hỏi lại' },
    { id: 'cl', label: '② Chiến lược', desc: 'tệp khách, cấu trúc, ngân sách, KPI' },
    { id: 'nd', label: '③ Nội dung', desc: 'mẫu quảng cáo (song song với ④)' },
    { id: 'tk', label: '④ Tracking', desc: 'checklist đo lường' },
    { id: 'th', label: '⑤ Tổng hợp', desc: 'bản tư vấn + báo giá, lưu Google Docs và Sheet' }
  ]);
  const inp = { client: c ? c.n : 'Khách mới', brief };
  inp.tiep_nhan = await agentStep(set, cache, 'tn', 'tiep_nhan', inp);
  inp.chien_luoc = await agentStep(set, cache, 'cl', 'chien_luoc', inp);
  [inp.noi_dung, inp.tracking] = await Promise.all([agentStep(set, cache, 'nd', 'noi_dung', inp), agentStep(set, cache, 'tk', 'tracking', inp)]);
  set('th', 'run', '<span class="hint-i">đang viết bản tư vấn và lưu file...</span>');
  try {
    const d = await AI.call('consultSave', { provider: agentModel('tong_hop'), input: inp, folder: folderOf(c, '02_Tu-van') });
    set('th', 'done', `<span class="hint-i">${d.provider}</span>`);
    delete RUNS[key];
    return d;
  } catch (err) { set('th', 'fail', `<span class="hint-i">${esc(err.message)}</span>`); throw err; }
}

async function summarize() {
  const brief = $('brief').value.trim(), ci = $('consultCl').value, c = ci === '' ? null : CLIENTS[+ci];
  if (!brief) { toast('Hãy nhập brief và yêu cầu của khách trước.'); return; }
  const btn = $('sum'), outEl = $('sumOut');
  const multi = $('mode').value !== 'fast';
  wait(btn, true, multi ? 'Các agent đang làm việc... (1-3 phút)' : 'AI đang phân tích... (khoảng 1 phút)');
  try {
    const d = multi ? await summarizeMulti(c, brief, outEl)
      : await AI.call('consult', { brief, client: c ? c.n : 'Khách mới', folder: folderOf(c, '02_Tu-van') });
    if (c) { c.docs = c.docs || []; c.docs.unshift({ t: new Date().toLocaleString('vi-VN'), title: d.doc.title, url: d.doc.url }); saveData(); }
    SEL.brief = '';
    if (!$('sumOut')) return; // đã chuyển trang
    outEl.hidden = false;
    const html = `<div class="sum"><div class="row"><a class="btn" href="${link(d.doc.url)}" target="_blank" rel="noopener">Mở file tư vấn (Google Docs) ↗</a><a class="crumb" href="${link(d.sheet)}" target="_blank" rel="noopener">Google Sheet ↗</a></div>
      <div class="mdout">${md(d.text)}</div>
      <p class="hint" style="margin:0">Đây là bản nháp của AI. Bạn sửa trong Google Docs và duyệt trước khi gửi khách.${multi ? ' File có thêm phụ lục nội bộ: câu cần hỏi khách, toàn bộ mẫu nội dung, checklist tracking.' : ''}</p></div>`;
    if (multi) outEl.querySelector('.pfinal').innerHTML = html; else outEl.innerHTML = html;
    toast('Đã tạo file tư vấn.');
  } catch (err) { toast(err.message + (multi ? ' Bấm lại "Gửi AI phân tích" để chạy tiếp từ bước lỗi.' : '')); }
  finally { wait(btn, false); }
}

async function analyzeAdMulti(c, a, box) {
  const key = 'a|' + c.n + '|' + a.url + '|' + (a.metrics || '') + '|' + (a.note || ''), cache = RUNS[key] = RUNS[key] || {};
  const set = pipeline(box, [
    { id: 'sl', label: '① Lấy số liệu', desc: 'từ Meta hoặc số liệu bạn dán' },
    { id: 'bc', label: '② Báo cáo', desc: 'đánh giá, đề xuất tối ưu' },
    { id: 'nd', label: '③ Nội dung', desc: 'mẫu quảng cáo mới để thử (song song với ④)' },
    { id: 'kd', label: '④ Kiểm duyệt', desc: 'soát số liệu và đề xuất' },
    { id: 'lu', label: '⑤ Lưu file', desc: 'Google Docs + Google Sheet' }
  ]);
  let data = cache.sl;
  if (!data) {
    set('sl', 'run');
    try { data = cache.sl = await AI.call('adData', { client: c.n, name: a.name, url: a.url, metrics: a.metrics || '', note: a.note || '' }); }
    catch (err) { set('sl', 'fail', `<span class="hint-i">${esc(err.message)}</span>`); throw err; }
  }
  set('sl', 'done', data.metaNote ? `<span class="hint-i">${esc(data.metaNote)}</span>` : '');
  const bc = await agentStep(set, cache, 'bc', 'bao_cao', { ad: data.ad });
  const [nd, kd] = await Promise.all([
    agentStep(set, cache, 'nd', 'noi_dung_ads', { ad: data.ad, bao_cao: bc }),
    agentStep(set, cache, 'kd', 'kiem_duyet', { ad: data.ad, bao_cao: bc })
  ]);
  set('lu', 'run');
  try {
    const d = await AI.call('adSave', { ad: data.ad, bao_cao: bc, noi_dung: nd, kiem_duyet: kd, url: a.url, folder: folderOf(c, '05_Bao-cao') });
    set('lu', 'done'); delete RUNS[key];
    return { ...d, result: bc, metaNote: data.metaNote, check: kd };
  } catch (err) { set('lu', 'fail', `<span class="hint-i">${esc(err.message)}</span>`); throw err; }
}

async function analyzeAd(ci, ai) {
  const c = CLIENTS[ci], a = c && c.ads && c.ads[ai]; if (!a) return;
  const btn = document.querySelector(`[data-analyze="${ci}:${ai}"]`);
  wait(btn, true, 'Đang phân tích...');
  const box = $(`adout-${ci}-${ai}`), multi = SEL.mode !== 'fast';
  if (box && !multi) { box.hidden = false; box.innerHTML = '<p class="hint">AI đang lấy số liệu và phân tích, khoảng 1 phút...</p>'; }
  try {
    const d = multi && box ? await analyzeAdMulti(c, a, box)
      : await AI.call('analyzeAd', { client: c.n, name: a.name, url: a.url, metrics: a.metrics || '', note: a.note || '', folder: folderOf(c, '05_Bao-cao') });
    const r = d.result, t = new Date().toLocaleString('vi-VN');
    if (!a.name && d.name) a.name = d.name;
    a.last = { t, danh_gia: r.danh_gia, tom_tat: r.tom_tat, doc: d.doc.url, sheet: d.sheet };
    c.docs = c.docs || []; c.docs.unshift({ t, title: d.doc.title, url: d.doc.url });
    saveData(); render(cur, false);
    const nb = $(`adout-${ci}-${ai}`);
    if (nb) {
      nb.hidden = false;
      nb.innerHTML = `${d.metaNote ? `<p class="hint">${esc(d.metaNote)}</p>` : ''}<div class="kpis">${[['Chi tiêu', r.chi_tieu], ['Hiển thị', r.hien_thi], ['CTR', r.ctr], ['CPM', r.cpm], ['Kết quả', r.ket_qua], ['Chi phí/kết quả', r.chi_phi_moi_ket_qua]].map(k => `<div><span>${k[0]}</span><b>${esc(k[1])}</b></div>`).join('')}</div>
        <h4>Nên làm ngay</h4><ul>${r.de_xuat.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${d.check ? `<h4>Kiểm duyệt</h4>${d.check.dat ? '<p class="hint">Đạt, không phát hiện vấn đề.</p>' : `<ul>${d.check.van_de.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="hint">File phân tích dùng bản báo cáo đã được agent Kiểm duyệt sửa.</p>`}` : ''}
        <details><summary>Xem báo cáo đầy đủ</summary><div class="mdout">${md(r.bao_cao_markdown)}</div></details>`;
    }
    toast('Đã tạo file phân tích và cập nhật Google Sheet.');
  } catch (err) {
    toast(err.message + (multi ? ' Bấm "Phân tích" lần nữa để chạy tiếp từ bước lỗi.' : ''));
    const nb = $(`adout-${ci}-${ai}`); if (nb && !multi) nb.innerHTML = `<p class="hint">${esc(err.message)}</p>`;
  } finally { wait(document.querySelector(`[data-analyze="${ci}:${ai}"]`), false); }
}

document.getElementById('map').addEventListener('click', e => { const s = e.target.closest('[data-id]'); if (s) go({ m: s.dataset.id, c: null }); });
document.getElementById('map').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const s = e.target.closest('.st'); if (s) { e.preventDefault(); go({ m: s.dataset.id, c: null }); }
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go === 'home' ? { m: null, c: null } : { m: g.dataset.go, c: null }); }
});
$('nBack').addEventListener('click', goBack);
$('nFwd').addEventListener('click', goFwd);
$('nReload').addEventListener('click', () => render(cur, false));
$('crumb').addEventListener('click', () => go(cur.c != null ? { m: cur.m, c: null } : { m: null, c: null }));
$('drive').addEventListener('click', openDrive);
$('todayBtn').addEventListener('click', () => { go({ m: null, c: null }); $('notes').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('modBody').addEventListener('click', e => {
  const c = e.target.closest('[data-client]'); if (c) { go({ m: cur.m, c: +c.dataset.client }); return; }
  const t = e.target.closest('[data-tab]'); if (t) { setTab(t.dataset.tab); return; }
  if (e.target.closest('#sum')) summarize();
  if (e.target.closest('#aiSet')) { if (AI.setup(true)) AI.call('ping', {}).then(d => toast('Đã kết nối backend, đang dùng ' + d.provider + '.' + (d.meta ? '' : ' Chưa có META_TOKEN: dán số liệu tay khi phân tích.'))).catch(err => toast(err.message)); }
  const an = e.target.closest('[data-analyze]'); if (an) { const [ci, ai] = an.dataset.analyze.split(':').map(Number); analyzeAd(ci, ai); }
  const ad = e.target.closest('[data-addel]');
  if (ad && confirm('Xoá ads này khỏi danh sách? File phân tích đã tạo vẫn giữ trên Drive.')) { CLIENTS[cur.c].ads.splice(+ad.dataset.addel, 1); saveData(); render(cur, false); }
  const sy = e.target.closest('[data-sync]'); if (sy) syncClient(+sy.dataset.sync, true);
  if (e.target.closest('#newCl')) { const f = $('clForm'); f.hidden = false; f.n.focus(); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (e.target.closest('#clCancel')) { $('clForm').reset(); $('clForm').hidden = true; }
  if (e.target.closest('#clDriveSave')) {
    const v = $('clDrive').value.trim();
    if (v && !link(v)) { toast('Link phải bắt đầu bằng https://'); return; }
    CLIENTS[cur.c].drive = v; saveData(); render(cur, false); toast(v ? 'Đã lưu link Drive.' : 'Đã xoá link Drive.');
  }
  if (e.target.closest('#clDel')) {
    const c = CLIENTS[cur.c];
    if (!confirm(`Xoá "${c.n}" khỏi web? Thư mục trên Google Drive vẫn giữ nguyên.`)) return;
    CLIENTS.splice(cur.c, 1); saveData(); go({ m: 'ads', c: null }); toast('Đã xoá ' + c.n + '.');
  }
});
$('modBody').addEventListener('submit', e => {
  if (e.target.id === 'adForm') {
    e.preventDefault();
    const f = e.target, u = f.url.value.trim(), c = CLIENTS[cur.c];
    if (!link(u)) { toast('Link ads phải bắt đầu bằng https://'); return; }
    c.ads = c.ads || []; c.ads.push({ name: f.name.value.trim(), url: u });
    saveData(); render(cur, false); toast('Đã thêm ads.'); return;
  }
  if (e.target.id !== 'clForm') return;
  e.preventDefault();
  const f = e.target, name = f.n.value.trim(), drive = f.drive.value.trim();
  if (!name) { toast('Nhập tên khách.'); return; }
  if (drive && !link(drive)) { toast('Link Drive phải bắt đầu bằng https://'); return; }
  CLIENTS.push({ n: name, s: +f.s.value, note: f.note.value.trim(), goal: f.goal.value, bud: +f.bud.value || 0, from: f.from.value, to: f.to.value, drive, links: {} });
  saveData(); go({ m: 'ads', c: CLIENTS.length - 1 }); toast('Đã tạo thư mục ' + name + '.');
});
$('modBody').addEventListener('input', e => { if (e.target.id === 'bud' || e.target.id === 'pct') calc(); if (e.target.id === 'brief') SEL.brief = e.target.value; });
$('modBody').addEventListener('change', e => {
  if (e.target.dataset && e.target.dataset.mk) { SEL[e.target.dataset.mk] = e.target.value; saveSel(); return; }
  if (e.target.dataset && e.target.dataset.flink) {
    const v = e.target.value.trim(), k = e.target.dataset.flink, c = CLIENTS[cur.c];
    if (v && !link(v)) { toast('Link phải bắt đầu bằng https://'); return; }
    c.links = c.links || {}; if (v) c.links[k] = v; else delete c.links[k];
    saveData(); render(cur, false); toast(v ? 'Đã lưu link ' + k + '.' : 'Đã xoá link ' + k + '.'); return;
  }
  if (e.target.id === 'clStage' || e.target.id === 'clNote') {
    const c = CLIENTS[cur.c];
    if (e.target.id === 'clStage') c.s = +e.target.value; else c.note = e.target.value.trim();
    saveData(); render(cur, false); toast('Đã lưu.'); return;
  }
  const d = e.target.dataset || {};
  if (d.admet !== undefined || d.adnote !== undefined) {
    const a = CLIENTS[cur.c].ads[+(d.admet !== undefined ? d.admet : d.adnote)];
    a[d.admet !== undefined ? 'metrics' : 'note'] = e.target.value.trim(); saveData(); toast('Đã lưu.');
  }
});

/* ===== Google Drive ===== */
// Chỉ nhận link https để tránh chèn mã lạ vào trang
function link(u) { return /^https:\/\/[^"<>\s]+$/.test(u || '') ? u : ''; }
function driveStatus(c) {
  if (!Drive.configured()) return 'Danh sách khách và link được lưu trong trình duyệt này. Khi nối Google Drive (Client ID), dữ liệu sẽ tự lưu lên Drive để dùng trên mọi máy.';
  return Drive.connected() ? 'Google Drive: đã kết nối. Trạng thái thư mục bên dưới lấy từ Drive.' : 'Google Drive: chưa kết nối. Bấm nút dưới để tạo sẵn 7 thư mục của khách trong Drive của bạn.';
}
function refreshDriveNote() {
  const n = $('drvNote'); if (!n) return;
  n.textContent = !Drive.configured() ? 'Google Drive chưa cấu hình. Xem README để lấy Client ID.'
    : Drive.connected() ? 'Đã kết nối Google Drive. Mỗi khách có một thư mục riêng ở đó.'
    : 'Google Drive chưa kết nối. Bấm nút Google Drive ở trên để đăng nhập.';
}
function saveData() {
  dataTime = Date.now();
  const d = { t: dataTime, clients: CLIENTS };
  try { localStorage.setItem(DATA_KEY, JSON.stringify(d)); } catch (e) { toast('Trình duyệt không cho lưu dữ liệu.'); }
  if (Drive.connected()) Drive.saveJson(DATA_FILE, d).catch(err => toast('Chưa lưu lên Drive: ' + err.message));
  refreshCounts();
}
// Lấy bản mới hơn giữa trình duyệt và Drive
async function pullData() {
  const d = await Drive.loadJson(DATA_FILE);
  if (d && Array.isArray(d.clients) && (d.t || 0) > dataTime) {
    setClients(d);
    try { localStorage.setItem(DATA_KEY, JSON.stringify(d)); } catch (e) { /* bỏ qua */ }
    refreshCounts(); render(cur, false);
  } else if (dataTime) await Drive.saveJson(DATA_FILE, { t: dataTime, clients: CLIENTS });
}
function refreshCounts() {
  MODULES.find(x => x.id === 'ads').badge = CLIENTS.filter(c => c.s <= 2).length;
  renderMap();
  $('sPend').textContent = MODULES.reduce((s, m) => s + m.badge, 0);
}
async function openDrive() {
  if (!Drive.configured()) { window.open('https://drive.google.com/', '_blank', 'noopener'); toast('Chưa cấu hình Client ID nên chỉ mở Google Drive.'); return; }
  const w = window.open('about:blank', '_blank'); // mở trước để trình duyệt không chặn popup
  try {
    if (!Drive.connected()) await Drive.connect(false);
    const id = await Drive.root();
    refreshDriveNote(); pullData().catch(err => toast(err.message));
    if (w) w.location = Drive.folderUrl(id); else window.open(Drive.folderUrl(id), '_blank', 'noopener');
  } catch (err) { if (w) w.close(); toast(err.message); }
}
async function syncClient(i, interactive) {
  const btn = $('drvSync'), stat = $('drvStat');
  try {
    if (!Drive.connected()) { if (!interactive) return; await Drive.connect(false); await pullData(); }
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đồng bộ...'; }
    const m = MODULES.find(x => x.id === 'ads');
    const res = await Drive.ensureClient(m.title, CLIENTS[i].n, FOLDERS.map(f => f[0]));
    const counts = await Drive.countFiles(res.subs.map(s => s.id));
    if (cur.c !== i) return; // người dùng đã chuyển trang
    res.subs.forEach((s, k) => {
      const n = counts[s.id], p = $('fp' + k), a = $('fl' + k);
      if (p) { p.textContent = n ? `${n} file` : 'Trống'; p.classList.toggle('on', n > 0); }
      if (a) { a.href = Drive.folderUrl(s.id); a.hidden = false; }
    });
    if (stat) stat.innerHTML = `Google Drive: đã kết nối. <a href="${Drive.folderUrl(res.id)}" target="_blank" rel="noopener">Mở thư mục ${esc(CLIENTS[i].n)} ↗</a>`;
    refreshDriveNote();
    if (interactive) toast('Đã đồng bộ thư mục Drive của ' + CLIENTS[i].n + '.');
  } catch (err) { toast(err.message); }
  finally { if (btn && cur.c === i) { btn.disabled = false; btn.textContent = 'Đồng bộ thư mục Drive'; } }
}

/* ===== Đọc đường dẫn #/slug/khach khi mở link trực tiếp ===== */
function fromHash() {
  const [slug, cl] = location.hash.replace(/^#\/?/, '').split('/');
  const m = MODULES.find(x => x.slug === slug && !x.locked);
  if (!m) return { m: null, c: null };
  const c = cl ? CLIENTS.findIndex(x => slugify(x.n) === cl) : -1;
  return { m: m.id, c: m.id === 'ads' && c >= 0 ? c : null };
}
window.addEventListener('hashchange', () => { const v = fromHash(); if (v.m !== cur.m || v.c !== cur.c) go(v); });

renderMap();
hist.push(fromHash()); hi = 0; render(hist[0], false);
refreshDriveNote();
if (Drive.connected()) pullData().catch(() => {});
