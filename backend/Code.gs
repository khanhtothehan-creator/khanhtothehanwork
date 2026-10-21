/* ===== Khanh's Work Space: backend chạy trên Google Apps Script =====
   Website gửi yêu cầu tới đây, script này:
   - gọi Claude để phân tích brief và viết tư vấn,
   - lấy số liệu ads từ Meta Marketing API, gọi Claude phân tích,
   - tạo file Google Docs trong thư mục Drive của khách và ghi một dòng vào Google Sheet.
   Khoá bí mật nằm trong Project Settings → Script properties, không nằm trong code:
     CLAUDE_API_KEY  (bắt buộc)  khoá API từ platform.claude.com
     APP_PASSCODE    (bắt buộc)  mã bạn tự đặt, website phải gửi đúng mã này
     META_TOKEN      (tuỳ chọn)  access token Meta có quyền ads_read
     SHEET_ID        (tự tạo)    bỏ trống, lần chạy đầu script tự tạo bảng tính
     CLAUDE_MODEL    (tuỳ chọn)  mặc định claude-opus-5-5
     CLAUDE_EFFORT   (tuỳ chọn)  low | medium | high, mặc định medium
     META_API_VERSION (tuỳ chọn) mặc định v23.0 */

const PROPS = PropertiesService.getScriptProperties();
const prop = (k, d) => PROPS.getProperty(k) || d;

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'Yêu cầu không hợp lệ.' }); }
  if (!prop('APP_PASSCODE') || req.key !== prop('APP_PASSCODE')) return out({ ok: false, error: 'unauthorized' });
  try {
    if (req.action === 'ping') return out({ ok: true, meta: !!prop('META_TOKEN'), claude: !!prop('CLAUDE_API_KEY') });
    if (req.action === 'consult') return out(consult(req));
    if (req.action === 'analyzeAd') return out(analyzeAd(req));
    return out({ ok: false, error: 'Không rõ yêu cầu: ' + req.action });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err) });
  }
}
function doGet() { return out({ ok: true, app: "Khanh's Work Space backend" }); }
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

/* ===== Claude ===== */
function claude(system, user, schema) {
  const key = prop('CLAUDE_API_KEY');
  if (!key) throw new Error('Chưa có CLAUDE_API_KEY trong Script properties.');
  const output = { effort: prop('CLAUDE_EFFORT', 'medium') };
  if (schema) output.format = { type: 'json_schema', schema };
  const body = {
    model: prop('CLAUDE_MODEL', 'claude-opus-5-5'),
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: output,
    // Bộ lọc an toàn đôi khi chặn nhầm; cho phép tự chuyển sang model dự phòng
    fallbacks: 'default'
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(body)
  });
  const code = res.getResponseCode(), data = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error('Claude báo lỗi ' + code + ': ' + ((data.error && data.error.message) || res.getContentText().slice(0, 200)));
  if (data.stop_reason === 'refusal') throw new Error('Claude từ chối yêu cầu này. Hãy sửa nội dung rồi thử lại.');
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (data.stop_reason === 'max_tokens') throw new Error('Câu trả lời quá dài, bị cắt giữa chừng. Hãy rút gọn đầu vào rồi thử lại.');
  return schema ? JSON.parse(text) : text;
}

/* ===== 1. Brief → tư vấn ===== */
const CONSULT_SYSTEM = `Bạn là chuyên gia tư vấn quảng cáo Meta Ads (Facebook, Instagram) làm việc cùng Khanh, một freelancer chạy ads cho shop, spa, quán, studio nhỏ ở Việt Nam.
Khanh dán brief của khách. Bạn viết bản phân tích và tư vấn bằng tiếng Việt để Khanh đọc, sửa, rồi gửi khách.
Định dạng: Markdown đơn giản, chỉ dùng tiêu đề (##), gạch đầu dòng (-), danh sách số và chữ đậm (**). Không dùng bảng, không dùng emoji.
Các phần, theo thứ tự:
## Tóm tắt yêu cầu
## Thông tin còn thiếu cần hỏi khách
## Đề xuất chiến lược (mục tiêu chiến dịch, tệp khách hàng, cấu trúc chiến dịch, phân bổ ngân sách, ý tưởng nội dung và hình ảnh)
## Kế hoạch triển khai (theo tuần) và KPI dự kiến
## Báo giá (phí quản lý 10-20% ngân sách ads của khách; nêu mức đề xuất và lý do)
## Rủi ro và lưu ý
Nếu brief thiếu số liệu thì nêu giả định rõ ràng thay vì bịa số. Viết ngắn gọn, thực tế, dùng được ngay.`;

function consult(req) {
  const brief = String(req.brief || '').trim();
  if (!brief) throw new Error('Brief đang trống.');
  const client = String(req.client || 'Khách mới');
  const text = claude(CONSULT_SYSTEM, `Tên khách: ${client}\n\nBrief và yêu cầu của khách:\n${brief}`);
  const title = `Tư vấn - ${client} - ${today()}`;
  const doc = writeDoc(title, text, folderFrom(req.folder, 'Tư vấn'));
  logRow('Tư vấn', ['Thời gian', 'Khách', 'Brief (rút gọn)', 'File tư vấn'],
    [new Date(), client, brief.slice(0, 300), doc.url]);
  return { ok: true, text, doc, sheet: sheetUrl() };
}

/* ===== 2. Link ads → số liệu Meta → phân tích ===== */
const AD_SYSTEM = `Bạn là chuyên gia phân tích hiệu quả quảng cáo Meta Ads, viết cho Khanh (freelancer chạy ads ở Việt Nam).
Bạn nhận thông tin một mẫu quảng cáo: cấu hình, số liệu tổng và số liệu theo ngày (nếu có), và ghi chú của Khanh.
Đánh giá theo mục tiêu của chiến dịch. So sánh với mức tham khảo thường gặp ở thị trường Việt Nam và nói rõ đó là mức tham khảo.
Chỉ dùng số có trong dữ liệu; thiếu số nào thì ghi "chưa có" và không bịa.
bao_cao_markdown viết bằng tiếng Việt, chỉ dùng ## tiêu đề, gạch đầu dòng, chữ đậm, không dùng bảng, gồm các phần:
## Tổng quan, ## Điểm tốt, ## Vấn đề, ## Đề xuất tối ưu (việc cụ thể, theo thứ tự ưu tiên), ## Nên theo dõi tiếp.`;

const AD_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['danh_gia', 'tom_tat', 'chi_tieu', 'hien_thi', 'ctr', 'cpm', 'ket_qua', 'chi_phi_moi_ket_qua', 'de_xuat', 'bao_cao_markdown'],
  properties: {
    danh_gia: { type: 'string', enum: ['Tốt', 'Ổn', 'Cần tối ưu', 'Kém', 'Chưa đủ dữ liệu'] },
    tom_tat: { type: 'string', description: 'Một đến hai câu tóm tắt' },
    chi_tieu: { type: 'string' }, hien_thi: { type: 'string' }, ctr: { type: 'string' }, cpm: { type: 'string' },
    ket_qua: { type: 'string', description: 'Số kết quả chính theo mục tiêu, kèm loại kết quả' },
    chi_phi_moi_ket_qua: { type: 'string' },
    de_xuat: { type: 'array', items: { type: 'string' }, description: 'Ba đến năm việc nên làm ngay' },
    bao_cao_markdown: { type: 'string' }
  }
};

function analyzeAd(req) {
  const client = String(req.client || 'Khách');
  const adId = adIdFrom(req.url || req.adId || '');
  let meta = null, metaNote = '';
  if (adId && prop('META_TOKEN')) {
    try { meta = metaAd(adId); } catch (err) { metaNote = 'Không lấy được số liệu Meta: ' + err.message; }
  } else metaNote = !adId ? 'Không tìm thấy ID ads trong link.' : 'Chưa có META_TOKEN nên không tự lấy số liệu.';
  if (!meta && !String(req.metrics || '').trim()) {
    throw new Error(metaNote + ' Hãy dán số liệu từ Ads Manager vào ô "Số liệu" rồi thử lại.');
  }
  const input = {
    khach: client, ten_ads: req.name || (meta && meta.ad && meta.ad.name) || '', ad_id: adId, link: req.url || '',
    du_lieu_meta: meta, so_lieu_khanh_dan: req.metrics || '', ghi_chu_cua_khanh: req.note || ''
  };
  const r = claude(AD_SYSTEM, 'Dữ liệu quảng cáo (JSON):\n' + JSON.stringify(input, null, 1), AD_SCHEMA);
  const name = input.ten_ads || ('Ads ' + adId);
  const head = `**Khách:** ${client}\n**Ads:** ${name}\n**Link:** ${req.url || ''}\n**Đánh giá:** ${r.danh_gia} - ${r.tom_tat}\n`;
  const doc = writeDoc(`Phân tích ads - ${client} - ${name} - ${today()}`, head + '\n' + r.bao_cao_markdown, folderFrom(req.folder, 'Phân tích ads'));
  logRow('Phân tích ads',
    ['Thời gian', 'Khách', 'Tên ads', 'ID ads', 'Đánh giá', 'Chi tiêu', 'Hiển thị', 'CTR', 'CPM', 'Kết quả', 'Chi phí/kết quả', 'Tóm tắt', 'Đề xuất', 'File phân tích', 'Link ads'],
    [new Date(), client, name, adId, r.danh_gia, r.chi_tieu, r.hien_thi, r.ctr, r.cpm, r.ket_qua, r.chi_phi_moi_ket_qua, r.tom_tat, r.de_xuat.join('\n'), doc.url, req.url || '']);
  return { ok: true, result: r, doc, sheet: sheetUrl(), metaNote, name };
}

// Nhận link Ads Manager (selected_ad_ids=..., ad_id=..., /ads/123...) hoặc ID ads dán trực tiếp
function adIdFrom(s) {
  s = String(s);
  const m = s.match(/(?:selected_ad_ids|ad_id|adId)=(\d{6,})/) || s.match(/\/ads?\/(\d{6,})/) || s.match(/^\s*(\d{6,})\s*$/);
  return m ? m[1] : '';
}

function metaGet(path, params) {
  const v = prop('META_API_VERSION', 'v23.0');
  const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(`https://graph.facebook.com/${v}/${path}?${q}&access_token=${encodeURIComponent(prop('META_TOKEN'))}`, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText() || '{}');
  if (data.error) throw new Error(data.error.message);
  return data;
}

function metaAd(id) {
  const ad = metaGet(id, { fields: 'name,status,effective_status,created_time,campaign{name,objective},adset{name,daily_budget,lifetime_budget,optimization_goal,targeting},creative{title,body,object_type,call_to_action_type}' });
  const fields = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions,cost_per_action_type,date_start,date_stop';
  const total = metaGet(id + '/insights', { date_preset: 'maximum', fields }).data;
  const daily = metaGet(id + '/insights', { date_preset: 'last_14d', time_increment: 1, fields: 'date_start,spend,impressions,clicks,ctr,cpm,actions' }).data;
  return { ad, tong: total && total[0], theo_ngay: daily };
}

/* ===== Google Docs, Drive, Sheets ===== */
function today() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd-MM-yyyy HH:mm'); }

// Link thư mục Drive của khách → thư mục; không có thì dùng "Khanh's Work Space/<tên mặc định>"
function folderFrom(link, fallbackName) {
  const m = String(link || '').match(/folders\/([\w-]+)/) || String(link || '').match(/[?&]id=([\w-]+)/);
  if (m) { try { return DriveApp.getFolderById(m[1]); } catch (err) { /* không mở được, dùng thư mục mặc định */ } }
  return childFolder(childFolder(DriveApp.getRootFolder(), "Khanh's Work Space"), fallbackName);
}
function childFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// Ghi Markdown đơn giản (##, -, 1., **đậm**) thành Google Docs
function writeDoc(title, md, folder) {
  const doc = DocumentApp.create(title), body = doc.getBody();
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.TITLE);
  String(md).split('\n').forEach(line => {
    const t = line.trim();
    if (!t) return;
    let p, m;
    if ((m = t.match(/^(#{1,4})\s+(.*)/))) p = body.appendParagraph(m[2]).setHeading(m[1].length <= 2 ? DocumentApp.ParagraphHeading.HEADING2 : DocumentApp.ParagraphHeading.HEADING3);
    else if ((m = t.match(/^[-*•]\s+(.*)/))) p = body.appendListItem(m[1]).setGlyphType(DocumentApp.GlyphType.BULLET);
    else if ((m = t.match(/^\d+[.)]\s+(.*)/))) p = body.appendListItem(m[1]).setGlyphType(DocumentApp.GlyphType.NUMBER);
    else p = body.appendParagraph(t);
    boldify(p.editAsText());
  });
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(folder);
  return { url: doc.getUrl(), title, folder: folder.getUrl() };
}
function boldify(text) {
  let s = text.getText(), m;
  while ((m = s.match(/\*\*(.+?)\*\*/))) {
    const start = m.index, inner = m[1];
    text.deleteText(start, start + m[0].length - 1);
    text.insertText(start, inner);
    text.setBold(start, start + inner.length - 1, true);
    s = text.getText();
  }
}

function sheet() {
  let id = prop('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (err) { /* tạo lại */ } }
  const ss = SpreadsheetApp.create("Khanh's Work Space - Phân tích ads");
  DriveApp.getFileById(ss.getId()).moveTo(childFolder(DriveApp.getRootFolder(), "Khanh's Work Space"));
  PROPS.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function sheetUrl() { return sheet().getUrl(); }
function logRow(tab, header, row) {
  const ss = sheet();
  let sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab);
    sh.appendRow(header);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#DDF0CF');
    sh.setFrozenRows(1);
    const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
    if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  }
  sh.appendRow(row);
}

/* ===== Chạy thử trong trình soạn thảo (bấm ▶ Run) ===== */
function kiemTra() {
  Logger.log('Claude: ' + claude('Trả lời ngắn gọn bằng tiếng Việt.', 'Chào bạn, hãy trả lời "Đã kết nối".'));
  Logger.log('Google Sheet: ' + sheetUrl());
  Logger.log('META_TOKEN: ' + (prop('META_TOKEN') ? 'đã có' : 'chưa có'));
}
