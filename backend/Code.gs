/* ===== Han's Work Space: backend chạy trên Google Apps Script =====
   Website gửi yêu cầu tới đây, script này:
   - gọi AI (Gemini miễn phí, hoặc Claude) để phân tích brief và viết tư vấn,
   - lấy số liệu ads từ Meta Marketing API, gọi AI phân tích,
   - tạo file Google Docs trong thư mục Drive của khách và ghi một dòng vào Google Sheet.
   Khoá bí mật nằm trong Project Settings → Script properties, không nằm trong code:
     GEMINI_API_KEY  (cần một trong hai) khoá miễn phí từ aistudio.google.com
     CLAUDE_API_KEY  (cần một trong hai) khoá trả phí từ platform.claude.com
     AI_PROVIDER     (tuỳ chọn)  gemini | claude, mặc định dùng loại có khoá (ưu tiên gemini)
     APP_PASSCODE    (bắt buộc)  mã bạn tự đặt, website phải gửi đúng mã này
     META_TOKEN      (tuỳ chọn)  access token Meta có quyền ads_read
     SHEET_ID        (tự tạo)    bỏ trống, lần chạy đầu script tự tạo bảng tính
     GEMINI_MODEL    (tuỳ chọn)  mặc định gemini-flash-latest (bản Flash mới nhất, có gói miễn phí)
     CLAUDE_MODEL    (tuỳ chọn)  mặc định claude-opus-5-5
     CLAUDE_EFFORT   (tuỳ chọn)  low | medium | high, mặc định medium
     META_API_VERSION (tuỳ chọn) mặc định v23.0 */

// Đổi mỗi khi cập nhật code, để website biết Web app đang chạy bản nào
const BACKEND_VERSION = '2026-10-21f dong-bo';
const PROPS = PropertiesService.getScriptProperties();
const prop = (k, d) => PROPS.getProperty(k) || d;
// Thư mục gốc trên Drive (đổi được bằng Script property ROOT_NAME)
const ROOT_NAME = () => prop('ROOT_NAME', "Han's Work Space");

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'Yêu cầu không hợp lệ.' }); }
  if (!prop('APP_PASSCODE') || req.key !== prop('APP_PASSCODE')) return out({ ok: false, error: 'unauthorized' });
  try {
    if (req.action === 'ping') return out({ ok: true, version: BACKEND_VERSION, meta: !!prop('META_TOKEN'), provider: provider() });
    if (req.action === 'consult') return out(consult(req));
    if (req.action === 'analyzeAd') return out(analyzeAd(req));
    // Đa tác tử: website gọi từng agent rồi gọi bước lưu
    if (req.action === 'agent') return out(runAgent(req));
    if (req.action === 'consultSave') return out(consultSave(req));
    if (req.action === 'adData') return out(adData(req));
    if (req.action === 'adSave') return out(adSave(req));
    // Quy trình theo thư mục khách: 02 tư vấn → 03 kế hoạch → 04 số liệu Meta → 05 báo cáo
    if (req.action === 'plan') return out(plan(req));
    if (req.action === 'metaPull') return out(metaPull(req));
    if (req.action === 'report') return out(report(req));
    if (req.action === 'upload') return out(upload(req));
    // Đồng bộ dữ liệu web (khách, link, việc cần làm) giữa các máy
    if (req.action === 'dataGet') return out(dataGet());
    if (req.action === 'dataSet') return out(dataSet(req));
    if (req.action === 'trash') return out(trash(req));
    // Google Calendar
    if (req.action === 'calList') return out(calList(req));
    if (req.action === 'calSave') return out(calSave(req));
    if (req.action === 'calDelete') return out(calDelete(req));
    return out({ ok: false, error: 'Không rõ yêu cầu: ' + req.action });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err) });
  }
}
function doGet() { return out({ ok: true, app: "Han's Work Space backend", version: BACKEND_VERSION }); }
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

/* ===== AI: chọn Gemini hoặc Claude ===== */
function provider() {
  const p = String(prop('AI_PROVIDER', '')).toLowerCase();
  if (p === 'gemini' || p === 'claude') return p;
  return prop('GEMINI_API_KEY') ? 'gemini' : prop('CLAUDE_API_KEY') ? 'claude' : 'chưa có khoá';
}
// Agent chọn gemini/claude riêng; loại nào chưa có khoá thì dùng loại mặc định
function pickProvider(want) {
  want = String(want || '').toLowerCase();
  if (want === 'gemini' && prop('GEMINI_API_KEY')) return 'gemini';
  if (want === 'claude' && prop('CLAUDE_API_KEY')) return 'claude';
  return provider();
}
function ai(system, user, schema, useProvider) {
  const p = useProvider || provider();
  if (p === 'gemini') return gemini(system, user, schema);
  if (p === 'claude') return claude(system, user, schema);
  throw new Error('Chưa có GEMINI_API_KEY hoặc CLAUDE_API_KEY trong Script properties.');
}

/* ===== Gemini (Google AI Studio, có gói miễn phí) ===== */
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/';
function gemini(system, user, schema) {
  const key = prop('GEMINI_API_KEY');
  if (!key) throw new Error('Chưa có GEMINI_API_KEY trong Script properties.');
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: 8192 }
  };
  if (schema) { body.generationConfig.responseMimeType = 'application/json'; body.generationConfig.responseSchema = toGeminiSchema(schema); }
  let model = prop('GEMINI_MODEL', 'gemini-flash-latest');
  let res = geminiRetry(model, body, key);
  // Tên model đổi theo thời gian: không tìm thấy thì tự chọn bản Flash đang có
  if (res.code === 404) { model = geminiModels(key)[0]; PROPS.setProperty('GEMINI_MODEL', model); res = geminiRetry(model, body, key); }
  // Model quá tải (503) hoặc hết lượt miễn phí của riêng model đó (429): thử lần lượt các model Flash khác
  if (res.code === 503 || res.code === 500 || res.code === 429) {
    const first = res;
    for (const m of geminiModels(key).filter(x => x !== model).slice(0, 5)) {
      const r2 = geminiRetry(m, body, key);
      if (r2.code === 200 || r2.code === 400) { res = r2; model = m; PROPS.setProperty('GEMINI_MODEL', m); break; }
    }
    if (res.code !== 200 && res.code !== 400) res = first;
  }
  // Schema không được hỗ trợ: thử lại, chỉ yêu cầu trả JSON
  if (res.code === 400 && schema) { delete body.generationConfig.responseSchema; res = geminiFetch(model, body, key); }
  const data = res.data;
  if (res.code === 429) throw new Error('Gemini hết lượt miễn phí ở mọi model Flash. Đợi 1 phút (hoặc sang ngày mai nếu hết lượt trong ngày) rồi thử lại. Google báo: ' + ((data.error && data.error.message) || '').slice(0, 160));
  if (res.code === 503 || res.code === 500) throw new Error('Gemini đang quá tải. Đợi vài phút rồi thử lại.');
  if (res.code !== 200) throw new Error('Gemini báo lỗi ' + res.code + ': ' + ((data.error && data.error.message) || '').slice(0, 200));
  if (data.promptFeedback && data.promptFeedback.blockReason) throw new Error('Gemini từ chối nội dung này (' + data.promptFeedback.blockReason + ').');
  const cand = (data.candidates || [])[0] || {};
  const text = ((cand.content && cand.content.parts) || []).filter(x => x.text && !x.thought).map(x => x.text).join('').trim();
  if (cand.finishReason === 'MAX_TOKENS') throw new Error('Câu trả lời quá dài, bị cắt giữa chừng. Hãy rút gọn đầu vào rồi thử lại.');
  if (!text) throw new Error('Gemini không trả lời (' + (cand.finishReason || 'không rõ lý do') + ').');
  return schema ? parseJson(text) : text;
}
function geminiFetch(model, body, key) {
  const res = UrlFetchApp.fetch(GEMINI_API + 'models/' + model + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key }, payload: JSON.stringify(body)
  });
  return { code: res.getResponseCode(), data: JSON.parse(res.getContentText() || '{}') };
}
// Gọi lại tối đa 3 lần khi Google báo quá tải (503/500)
function geminiRetry(model, body, key) {
  let res;
  for (let i = 0; i < 3; i++) {
    res = geminiFetch(model, body, key);
    if (res.code !== 503 && res.code !== 500) return res;
    Utilities.sleep(2000 * (i + 1));
  }
  return res;
}
// Danh sách model Flash dùng được, mới nhất trước (bản thường trước bản lite)
function geminiModels(key) {
  const res = UrlFetchApp.fetch(GEMINI_API + 'models?pageSize=200', { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true });
  const list = (JSON.parse(res.getContentText() || '{}').models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(n => /flash/.test(n) && !/image|tts|audio|live|preview|exp/.test(n))
    .sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || b.localeCompare(a, 'en', { numeric: true }));
  if (!list.length) throw new Error('Không tìm thấy model Gemini Flash nào. Đặt GEMINI_MODEL trong Script properties.');
  return list;
}
// JSON Schema → định dạng schema của Gemini (bỏ các trường Gemini không nhận)
function toGeminiSchema(s) {
  const o = {};
  ['type', 'description', 'enum', 'required'].forEach(k => { if (s[k] !== undefined) o[k] = s[k]; });
  if (s.properties) { o.properties = {}; Object.keys(s.properties).forEach(k => { o.properties[k] = toGeminiSchema(s.properties[k]); }); }
  if (s.items) o.items = toGeminiSchema(s.items);
  return o;
}
function parseJson(text) {
  const t = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (err) { throw new Error('AI trả về dữ liệu không đúng dạng. Hãy thử lại.'); }
}

/* ===== Claude (trả phí) ===== */
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
  return schema ? parseJson(text) : text;
}

/* ===== 1. Brief → tư vấn ===== */
const CONSULT_SYSTEM = `Bạn là chuyên gia tư vấn quảng cáo Meta Ads (Facebook, Instagram) làm việc cùng Han, một freelancer chạy ads cho shop, spa, quán, studio nhỏ ở Việt Nam.
Han dán brief của khách. Bạn viết bản phân tích và tư vấn bằng tiếng Việt để Han đọc, sửa, rồi gửi khách.
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
  const text = ai(CONSULT_SYSTEM, `Tên khách: ${client}\n\nBrief và yêu cầu của khách:\n${brief}`);
  const title = `Tư vấn - ${client} - ${today()}`;
  const folders = clientFolders(req, client, '02_Tu-van');
  const doc = writeDoc(title, text, folders.target);
  const briefDoc = saveBrief(req, folders, client, brief);
  logRow('Tư vấn', ['Thời gian', 'Khách', 'Brief (rút gọn)', 'File tư vấn'],
    [new Date(), client, brief.slice(0, 300), doc.url]);
  return { ok: true, text, doc, briefDoc, sheet: sheetUrl(), folders: folders.links };
}

/* ===== 2. Link ads → số liệu Meta → phân tích ===== */
const AD_SYSTEM = `Bạn là chuyên gia phân tích hiệu quả quảng cáo Meta Ads, viết cho Han (freelancer chạy ads ở Việt Nam).
Bạn nhận thông tin một mẫu quảng cáo: cấu hình, số liệu tổng và số liệu theo ngày (nếu có), và ghi chú của Han.
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

// Gom dữ liệu một mẫu ads: số liệu Meta (nếu có token) + số liệu Han dán tay
function adInput(req) {
  const client = String(req.client || 'Khách');
  const adId = adIdFrom(req.url || req.adId || '');
  let meta = null, metaNote = '';
  if (adId && prop('META_TOKEN')) {
    try { meta = metaAd(adId); } catch (err) { metaNote = 'Không lấy được số liệu Meta: ' + err.message; }
  } else metaNote = !adId ? 'Không tìm thấy ID ads trong link.' : 'Chưa có META_TOKEN nên không tự lấy số liệu.';
  if (!meta && !String(req.metrics || '').trim()) {
    throw new Error(metaNote + ' Hãy dán số liệu từ Ads Manager vào ô "Số liệu" rồi thử lại.');
  }
  return {
    metaNote, input: {
      khach: client, ten_ads: req.name || (meta && meta.ad && meta.ad.name) || '', ad_id: adId, link: req.url || '',
      du_lieu_meta: meta, so_lieu_khanh_dan: req.metrics || '', ghi_chu_cua_khanh: req.note || ''
    }
  };
}
const adPrompt = input => 'Dữ liệu quảng cáo (JSON):\n' + JSON.stringify(input, null, 1) + '\n\nTrả về JSON với các trường: ' + Object.keys(AD_SCHEMA.properties).join(', ') + '. danh_gia là một trong: ' + AD_SCHEMA.properties.danh_gia.enum.join(', ') + '.';

// Tạo file phân tích + ghi một dòng vào Google Sheet
function adFinish(req, input, r, body) {
  const client = input.khach, name = input.ten_ads || ('Ads ' + input.ad_id);
  const head = `**Khách:** ${client}\n**Ads:** ${name}\n**Link:** ${req.url || ''}\n**Đánh giá:** ${r.danh_gia} - ${r.tom_tat}\n`;
  const folders = clientFolders(req, client, '05_Bao-cao');
  const doc = writeDoc(`Phân tích ads - ${client} - ${name} - ${today()}`, head + '\n' + body, folders.target);
  logRow('Phân tích ads',
    ['Thời gian', 'Khách', 'Tên ads', 'ID ads', 'Đánh giá', 'Chi tiêu', 'Hiển thị', 'CTR', 'CPM', 'Kết quả', 'Chi phí/kết quả', 'Tóm tắt', 'Đề xuất', 'File phân tích', 'Link ads'],
    [new Date(), client, name, input.ad_id, r.danh_gia, r.chi_tieu, r.hien_thi, r.ctr, r.cpm, r.ket_qua, r.chi_phi_moi_ket_qua, r.tom_tat, r.de_xuat.join('\n'), doc.url, req.url || '']);
  return { doc, sheet: sheetUrl(), name, folders: folders.links };
}

function analyzeAd(req) {
  const { input, metaNote } = adInput(req);
  const r = fillAd(ai(AD_SYSTEM, adPrompt(input), AD_SCHEMA));
  const f = adFinish(req, input, r, r.bao_cao_markdown);
  return { ok: true, result: r, doc: f.doc, sheet: f.sheet, metaNote, name: f.name, folders: f.folders };
}

// Bổ sung trường còn thiếu nếu AI trả về không đủ
function fillAd(r) {
  r = r || {};
  Object.keys(AD_SCHEMA.properties).forEach(k => { if (r[k] === undefined || r[k] === null) r[k] = k === 'de_xuat' ? [] : 'chưa có'; });
  if (!Array.isArray(r.de_xuat)) r.de_xuat = [String(r.de_xuat)];
  return r;
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

/* ===== Đa tác tử =====
   Brief: Tiếp nhận → Chiến lược → (Nội dung ∥ Tracking) → Tổng hợp (consultSave)
   Ads:   adData → Báo cáo → (Nội dung ads ∥ Kiểm duyệt) → adSave
   Mỗi agent một lần gọi, website hiển thị tiến độ từng bước. */
const MD_RULE = 'Viết bằng tiếng Việt, Markdown đơn giản: chỉ dùng ## tiêu đề, gạch đầu dòng (-), danh sách số, chữ đậm (**). Không dùng bảng, không dùng emoji. Ngắn gọn, thực tế. Thiếu số liệu thì nêu giả định, không bịa.';
const ROLE = 'Bạn là một agent trong nhóm trợ lý chạy quảng cáo Meta Ads (Facebook, Instagram) của Han, freelancer làm cho shop, spa, quán, studio nhỏ ở Việt Nam. ';
const T = (label, v) => v ? `\n\n### ${label}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}` : '';

const AGENT_DEFS = {
  tiep_nhan: {
    system: ROLE + 'Vai trò: agent Tiếp nhận. Đọc brief, chuẩn hoá thông tin. Các phần: ## Tóm tắt brief (sản phẩm/dịch vụ, khách hàng mục tiêu, mục tiêu kinh doanh, ngân sách, thời gian, khu vực, kênh nhận khách), ## Thông tin còn thiếu (câu hỏi cụ thể để Han hỏi lại khách), ## Giả định tạm thời. ' + MD_RULE,
    user: i => `Khách: ${i.client}${T('Brief của khách', i.brief)}`
  },
  chien_luoc: {
    system: ROLE + 'Vai trò: agent Chiến lược. Dựa trên brief và bản tiếp nhận, đề xuất: ## Mục tiêu chiến dịch trên Meta, ## Tệp khách hàng (tệp chính, tệp mở rộng, tệp remarketing), ## Cấu trúc chiến dịch (campaign, nhóm quảng cáo, số mẫu ads), ## Phân bổ ngân sách (theo giai đoạn và nhóm), ## Lịch triển khai theo tuần, ## KPI dự kiến (ghi rõ là ước tính và cơ sở ước tính). ' + MD_RULE,
    user: i => `Khách: ${i.client}${T('Brief', i.brief)}${T('Bản tiếp nhận', i.tiep_nhan)}`
  },
  noi_dung: {
    system: ROLE + 'Vai trò: agent Nội dung. Viết 3 đến 5 mẫu quảng cáo phù hợp chiến lược. Mỗi mẫu: tên ads theo quy tắc Khach_MucTieu_Tep_Content_NgayThang, tiêu đề, nội dung chính, lời kêu gọi hành động, ý tưởng hình ảnh hoặc video (cảnh mở đầu 3 giây). Cuối cùng: ## Gợi ý thử nghiệm A/B. ' + MD_RULE,
    user: i => `Khách: ${i.client}${T('Brief', i.brief)}${T('Chiến lược', i.chien_luoc)}`
  },
  tracking: {
    system: ROLE + 'Vai trò: agent Tracking. Lập checklist cài đặt đo lường theo chiến lược: ## Pixel và Conversions API (nếu có website), ## Sự kiện cần đo (theo kênh nhận khách: tin nhắn Messenger/Instagram, form, website, gọi điện), ## Đặt tên và UTM, ## Cách đọc KPI hằng tuần. Dạng checklist từng bước. ' + MD_RULE,
    user: i => `Khách: ${i.client}${T('Brief', i.brief)}${T('Chiến lược', i.chien_luoc)}`
  },
  tong_hop: {
    system: ROLE + 'Vai trò: agent Tổng hợp. Từ kết quả các agent, viết BẢN TƯ VẤN gửi khách, giọng lịch sự, chuyên nghiệp, dễ hiểu với chủ shop. Các phần: ## Hiểu về nhu cầu của anh/chị, ## Đề xuất chiến lược, ## Nội dung quảng cáo đề xuất (chọn 2-3 mẫu tốt nhất), ## Kế hoạch triển khai và KPI, ## Báo giá (phí quản lý 10-20% ngân sách ads; nêu mức đề xuất, lý do, ngân sách ads khách trả riêng cho Meta), ## Bước tiếp theo. Không đưa câu hỏi nội bộ hay checklist kỹ thuật vào bản này. ' + MD_RULE,
    user: i => `Khách: ${i.client}${T('Brief', i.brief)}${T('Tiếp nhận', i.tiep_nhan)}${T('Chiến lược', i.chien_luoc)}${T('Nội dung', i.noi_dung)}${T('Tracking', i.tracking)}`
  },
  bao_cao: {
    system: AD_SYSTEM, schema: AD_SCHEMA,
    user: i => adPrompt(i.ad)
  },
  noi_dung_ads: {
    system: ROLE + 'Vai trò: agent Nội dung (tối ưu ads). Dựa trên số liệu và báo cáo, viết: ## Vì sao mẫu hiện tại chưa tốt (hoặc vì sao tốt), ## 3 mẫu nội dung mới để thử (tiêu đề, nội dung, lời kêu gọi, ý tưởng hình/video, tên ads theo quy tắc Khach_MucTieu_Tep_Content_NgayThang), ## Cách thử nghiệm (ngân sách, thời gian, tiêu chí chọn mẫu thắng). ' + MD_RULE,
    user: i => `${T('Dữ liệu ads', i.ad)}${T('Báo cáo của agent Báo cáo', i.bao_cao)}`
  },
  kiem_duyet: {
    system: ROLE + 'Vai trò: agent Kiểm duyệt. So báo cáo với dữ liệu gốc: số nào không có trong dữ liệu hoặc tính sai, kết luận nào mâu thuẫn, đề xuất nào rủi ro (vi phạm chính sách quảng cáo Meta, thay đổi quá lớn khi đang học). Trả về JSON: dat (true nếu báo cáo dùng được nguyên), van_de (danh sách vấn đề, rỗng nếu không có), bao_cao_markdown (bản báo cáo đã sửa; nếu đạt thì chép nguyên bản gốc). ' + MD_RULE,
    schema: {
      type: 'object', additionalProperties: false, required: ['dat', 'van_de', 'bao_cao_markdown'],
      properties: { dat: { type: 'boolean' }, van_de: { type: 'array', items: { type: 'string' } }, bao_cao_markdown: { type: 'string' } }
    },
    user: i => `${T('Dữ liệu ads gốc', i.ad)}${T('Báo cáo cần kiểm tra', i.bao_cao)}\n\nTrả về JSON với các trường: dat, van_de, bao_cao_markdown.`
  }
};

function runAgent(req) {
  const a = AGENT_DEFS[req.agent];
  if (!a) throw new Error('Không có agent: ' + req.agent);
  const used = pickProvider(req.provider);
  let output = ai(a.system, a.user(req.input || {}), a.schema, used);
  if (req.agent === 'bao_cao') output = fillAd(output);
  if (req.agent === 'kiem_duyet') output = { dat: !!output.dat, van_de: [].concat(output.van_de || []), bao_cao_markdown: String(output.bao_cao_markdown || '') };
  return { ok: true, agent: req.agent, provider: used, output };
}

// Bước cuối luồng brief: agent Tổng hợp viết bản gửi khách, rồi lưu Google Docs + Sheet
function consultSave(req) {
  const i = req.input || {};
  if (!String(i.brief || '').trim()) throw new Error('Brief đang trống.');
  const used = pickProvider(req.provider);
  const text = ai(AGENT_DEFS.tong_hop.system, AGENT_DEFS.tong_hop.user(i), null, used);
  const client = String(i.client || 'Khách mới');
  const appendix = '\n\n# Phụ lục nội bộ (không gửi khách)\n## Câu hỏi cần hỏi lại khách và giả định\n' + (i.tiep_nhan || '')
    + '\n\n## Chiến lược chi tiết\n' + (i.chien_luoc || '') + '\n\n## Toàn bộ mẫu nội dung\n' + (i.noi_dung || '') + '\n\n## Checklist tracking\n' + (i.tracking || '');
  const title = `Tư vấn - ${client} - ${today()}`;
  const folders = clientFolders(req, client, '02_Tu-van');
  const doc = writeDoc(title, text + appendix.replace(/^### /gm, '## '), folders.target);
  const briefDoc = saveBrief(req, folders, client, String(i.brief));
  logRow('Tư vấn', ['Thời gian', 'Khách', 'Brief (rút gọn)', 'File tư vấn'], [new Date(), client, String(i.brief).slice(0, 300), doc.url]);
  return { ok: true, provider: used, text, doc, briefDoc, sheet: sheetUrl(), folders: folders.links };
}

// Bước đầu luồng ads: lấy số liệu (Meta hoặc dán tay) để các agent dùng chung
function adData(req) {
  const d = adInput(req);
  return { ok: true, ad: d.input, metaNote: d.metaNote };
}

// Bước cuối luồng ads: ghép báo cáo đã kiểm duyệt + mẫu nội dung mới, lưu Docs + Sheet
function adSave(req) {
  const input = req.ad || {}, r = fillAd(req.bao_cao), k = req.kiem_duyet || {};
  const body = (k.bao_cao_markdown || r.bao_cao_markdown)
    + (req.noi_dung ? '\n\n## Mẫu nội dung mới (agent Nội dung)\n' + String(req.noi_dung).replace(/^##\s+/gm, '### ') : '')
    + '\n\n## Kiểm duyệt\n' + (k.dat ? '- Báo cáo đạt, không phát hiện vấn đề.' : (k.van_de || []).map(v => '- ' + v).join('\n') || '- Chưa kiểm duyệt.');
  const f = adFinish(req, input, r, body);
  return { ok: true, doc: f.doc, sheet: f.sheet, name: f.name, folders: f.folders };
}

/* ===== 03 Kế hoạch: đọc bản tư vấn đã sửa trong 02_Tu-van → kế hoạch setup chi tiết ===== */
const PLAN_SYSTEM = ROLE + 'Vai trò: agent Kế hoạch. Han đã sửa và chốt bản tư vấn với khách. Từ bản tư vấn đó, lập KẾ HOẠCH SETUP CHI TIẾT để Han làm theo trong Ads Manager. Các phần: ## Mục tiêu và KPI đã chốt, ## Cấu trúc tài khoản (từng chiến dịch: tên theo quy tắc Khach_MucTieu_Tep_Content_NgayThang, mục tiêu Meta, ngân sách/ngày, lịch chạy; từng nhóm quảng cáo: tệp, độ tuổi, khu vực, sở thích hoặc tệp tuỳ chỉnh, vị trí hiển thị; từng mẫu ads), ## Nội dung và tài nguyên cần chuẩn bị (danh sách hình/video/caption, ai làm, hạn), ## Checklist cài đặt trước khi chạy (Pixel, sự kiện, Messenger/form, thanh toán, quyền tài khoản), ## Lịch triển khai theo ngày/tuần, ## Ngưỡng tối ưu (khi nào tắt, khi nào tăng ngân sách, theo chỉ số cụ thể). Bám sát nội dung đã chốt, không tự đổi ngân sách hay mục tiêu. ' + MD_RULE;

function plan(req) {
  const client = String(req.client || 'Khách');
  const src = latestDoc(req.sourceFolder, req.sourceDoc);
  if (!src) throw new Error('Chưa có bản tư vấn trong 02_Tu-van. Hãy chạy bước 01_Brief trước.');
  const used = pickProvider(req.provider);
  const text = ai(PLAN_SYSTEM, `Khách: ${client}${T('Bản tư vấn đã chốt (' + src.title + ')', src.text)}${T('Ghi chú thêm của Han', req.note)}`, null, used);
  const folders = clientFolders(req, client, '03_Ke-hoach-setup');
  const doc = writeDoc(`Kế hoạch setup - ${client} - ${today()}`, `**Dựa trên:** ${src.title}\n\n` + text, folders.target);
  return { ok: true, provider: used, text, doc, source: { title: src.title, url: src.url }, folders: folders.links };
}

/* ===== 04 Số liệu Meta: tài khoản quảng cáo + từng chiến dịch ===== */
const RANGES = { last_7d: '7 ngày qua', last_14d: '14 ngày qua', last_30d: '30 ngày qua', this_month: 'Tháng này', last_month: 'Tháng trước', maximum: 'Từ trước đến nay' };
// Loại kết quả chính theo mục tiêu chiến dịch
const RESULT_PREFS = {
  msg: [['onsite_conversion.messaging_conversation_started_7d', 'Tin nhắn']],
  lead: [['onsite_conversion.lead_grouped', 'Khách tiềm năng'], ['lead', 'Khách tiềm năng'], ['offsite_conversion.fb_pixel_lead', 'Khách tiềm năng']],
  buy: [['omni_purchase', 'Mua hàng'], ['offsite_conversion.fb_pixel_purchase', 'Mua hàng'], ['purchase', 'Mua hàng']],
  click: [['link_click', 'Click liên kết']],
  eng: [['post_engagement', 'Tương tác'], ['video_view', 'Lượt xem video']]
};
const OBJ_PREF = {
  OUTCOME_ENGAGEMENT: ['msg', 'eng'], MESSAGES: ['msg'], OUTCOME_LEADS: ['lead', 'msg'], LEAD_GENERATION: ['lead'],
  OUTCOME_SALES: ['buy', 'msg'], CONVERSIONS: ['buy', 'lead'], OUTCOME_TRAFFIC: ['click'], LINK_CLICKS: ['click'], POST_ENGAGEMENT: ['eng'], VIDEO_VIEWS: ['eng']
};
function resultOf(row, objective) {
  const spend = +row.spend || 0, acts = row.actions || [];
  if (/AWARENESS|REACH/.test(objective || '')) return { label: 'Người tiếp cận', value: +row.reach || 0, cost: row.reach ? spend / row.reach * 1000 : 0, per: '1.000 người' };
  const groups = (OBJ_PREF[objective] || []).concat(['msg', 'lead', 'buy', 'click', 'eng']);
  for (const g of groups) for (const [type, label] of RESULT_PREFS[g]) {
    const a = acts.find(x => x.action_type === type);
    if (a && +a.value > 0) return { label, value: +a.value, cost: spend / +a.value, per: label.toLowerCase() };
  }
  return { label: 'Chưa có kết quả', value: 0, cost: 0, per: '' };
}
const accountId = s => { const m = String(s || '').match(/act[_=](\d+)/) || String(s || '').match(/^\s*(\d{5,})\s*$/); return m ? m[1] : ''; };
function metaAll(path, params) {
  let d = metaGet(path, Object.assign({ limit: 500 }, params)), rows = d.data || [];
  while (d.paging && d.paging.next && rows.length < 2000) {
    d = JSON.parse(UrlFetchApp.fetch(d.paging.next, { muteHttpExceptions: true }).getContentText() || '{}');
    if (d.error) throw new Error(d.error.message);
    rows = rows.concat(d.data || []);
  }
  return rows;
}

function metaPull(req) {
  if (!prop('META_TOKEN')) throw new Error('Chưa có META_TOKEN trong Script properties (xem Bước 5 trong HUONG-DAN.md). Tạm thời có thể dán số liệu xuất từ Ads Manager vào ô bên dưới.');
  const id = accountId(req.account);
  if (!id) throw new Error('Nhập ID tài khoản quảng cáo (dạng act_123456789 hoặc dán link Ads Manager có act=...).');
  const client = String(req.client || 'Khách'), range = RANGES[req.range] ? req.range : 'last_7d';
  const fields = 'spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions';
  const acc = metaGet('act_' + id, { fields: 'name,currency,account_status,amount_spent' });
  const total = (metaGet('act_' + id + '/insights', { date_preset: range, fields }).data || [])[0] || {};
  const camps = metaAll('act_' + id + '/campaigns', { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget' });
  const ins = metaAll('act_' + id + '/insights', { level: 'campaign', date_preset: range, fields: 'campaign_id,' + fields });
  const byId = {}; ins.forEach(x => { byId[x.campaign_id] = x; });
  const campaigns = camps.map(c => {
    const x = byId[c.id] || {}, res = resultOf(x, c.objective);
    return {
      id: c.id, name: c.name, status: c.effective_status || c.status, objective: c.objective,
      budget: c.daily_budget ? +c.daily_budget + '/ngày' : c.lifetime_budget ? +c.lifetime_budget + ' trọn đời' : '',
      spend: +x.spend || 0, impressions: +x.impressions || 0, reach: +x.reach || 0, clicks: +x.clicks || 0,
      ctr: +x.ctr || 0, cpm: +x.cpm || 0, result_label: res.label, results: res.value, cost_per_result: Math.round(res.cost)
    };
  }).filter(c => c.spend > 0 || c.status === 'ACTIVE').sort((a, b) => b.spend - a.spend);
  const sum = {};
  campaigns.forEach(c => { if (c.results) sum[c.result_label] = (sum[c.result_label] || 0) + c.results; });
  const account = {
    id: 'act_' + id, name: acc.name, currency: acc.currency, range, range_label: RANGES[range],
    spend: +total.spend || 0, impressions: +total.impressions || 0, reach: +total.reach || 0, clicks: +total.clicks || 0,
    ctr: +total.ctr || 0, cpm: +total.cpm || 0, results: Object.keys(sum).map(k => k + ': ' + sum[k]).join(', ')
  };
  const folders = clientFolders(req, client, '04_So-ads-Meta');
  const sheet = clientSheet(folders.target, `Số liệu Meta - ${client}`);
  const now = new Date();
  appendTab(sheet, 'Tài khoản', ['Thời gian lấy', 'Khoảng thời gian', 'Tài khoản', 'Tiền tệ', 'Chi tiêu', 'Hiển thị', 'Tiếp cận', 'Click', 'CTR (%)', 'CPM', 'Kết quả'],
    [[now, account.range_label, account.name + ' (' + account.id + ')', account.currency, account.spend, account.impressions, account.reach, account.clicks, account.ctr, account.cpm, account.results]]);
  appendTab(sheet, 'Chiến dịch', ['Thời gian lấy', 'Khoảng thời gian', 'Chiến dịch', 'ID', 'Trạng thái', 'Mục tiêu', 'Ngân sách', 'Chi tiêu', 'Hiển thị', 'Tiếp cận', 'Click', 'CTR (%)', 'CPM', 'Loại kết quả', 'Kết quả', 'Chi phí/kết quả'],
    campaigns.map(c => [now, account.range_label, c.name, c.id, c.status, c.objective, c.budget, c.spend, c.impressions, c.reach, c.clicks, c.ctr, c.cpm, c.result_label, c.results, c.cost_per_result]));
  return { ok: true, account, campaigns, sheet: sheet.getUrl(), folders: folders.links };
}

// Bảng tính riêng của khách trong 04_So-ads-Meta (giữ lịch sử mỗi lần lấy số liệu)
function clientSheet(folder, name) {
  const it = folder.getFilesByName(name);
  if (it.hasNext()) return SpreadsheetApp.openById(it.next().getId());
  const ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return ss;
}
function appendTab(ss, tab, header, rows) {
  let sh = ss.getSheetByName(tab);
  if (!sh) {
    sh = ss.insertSheet(tab); sh.appendRow(header);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#DDF0CF'); sh.setFrozenRows(1);
    const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
    if (first && first.getLastRow() === 0) ss.deleteSheet(first);
  }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
}

/* ===== 05 Báo cáo: số liệu 04 + kế hoạch 03 → đánh giá và đề xuất chỉnh sửa ===== */
const REPORT_SYSTEM = ROLE + 'Vai trò: agent Báo cáo tài khoản. Từ số liệu tài khoản quảng cáo và từng chiến dịch (và kế hoạch/KPI nếu có), viết báo cáo cho Han. Các phần: ## Tổng quan tài khoản (chi tiêu, kết quả chính, chi phí/kết quả, xu hướng nếu có), ## Đánh giá từng chiến dịch (mỗi chiến dịch: Tốt / Ổn / Cần tối ưu / Kém, kèm lý do bằng số liệu), ## So với kế hoạch và KPI (nếu có kế hoạch), ## Đề xuất chỉnh sửa (việc cụ thể theo thứ tự ưu tiên: tăng/giảm ngân sách bao nhiêu phần trăm, tắt, nhân bản, đổi nội dung, đổi tệp; nêu chỉ số căn cứ), ## Việc cần làm tuần tới, ## Tóm tắt gửi khách (3-5 câu, lời lẽ dễ hiểu). Chỉ dùng số có trong dữ liệu; so sánh với mức tham khảo thị trường Việt Nam thì ghi rõ là tham khảo. ' + MD_RULE;

function report(req) {
  const client = String(req.client || 'Khách');
  const paste = String(req.paste || '').trim();
  if (!req.meta && !paste) throw new Error('Chưa có số liệu. Bấm "Lấy số liệu Meta" ở bước 04, hoặc dán số liệu xuất từ Ads Manager.');
  const planDoc = latestDoc(req.planFolder, req.planDoc);
  const used = pickProvider(req.provider);
  const data = { so_lieu_meta: req.meta || null, so_lieu_dan_tay: paste || null };
  let text = ai(REPORT_SYSTEM, `Khách: ${client}${T('Số liệu', data)}${planDoc ? T('Kế hoạch đã chốt (' + planDoc.title + ')', planDoc.text.slice(0, 15000)) : ''}${T('Ghi chú của Han', req.note)}`, null, used);
  let check = null;
  if (req.review) {
    const k = AGENT_DEFS.kiem_duyet;
    check = ai(k.system, k.user({ ad: data, bao_cao: { bao_cao_markdown: text } }), k.schema, pickProvider(req.reviewProvider));
    check = { dat: !!check.dat, van_de: [].concat(check.van_de || []), bao_cao_markdown: String(check.bao_cao_markdown || '') };
    if (!check.dat && check.bao_cao_markdown) text = check.bao_cao_markdown;
  }
  const folders = clientFolders(req, client, '05_Bao-cao');
  const head = req.meta && req.meta.account ? `**Tài khoản:** ${req.meta.account.name || ''} (${req.meta.account.id || ''}) · **Thời gian:** ${req.meta.account.range_label || ''}\n` : '';
  const body = head + (planDoc ? `**Đối chiếu kế hoạch:** ${planDoc.title}\n` : '') + '\n' + text
    + (check ? '\n\n## Kiểm duyệt\n' + (check.dat ? '- Báo cáo đạt, không phát hiện vấn đề.' : check.van_de.map(v => '- ' + v).join('\n')) : '');
  const doc = writeDoc(`Báo cáo - ${client} - ${today()}`, body, folders.target);
  logRow('Báo cáo tài khoản', ['Thời gian', 'Khách', 'Tài khoản', 'Khoảng thời gian', 'Chi tiêu', 'Kết quả', 'File báo cáo'],
    [new Date(), client, req.meta && req.meta.account ? req.meta.account.id : 'số liệu dán tay', req.meta && req.meta.account ? req.meta.account.range_label : '',
      req.meta && req.meta.account ? req.meta.account.spend : '', req.meta && req.meta.account ? req.meta.account.results : '', doc.url]);
  return { ok: true, provider: used, text, check, doc, sheet: sheetUrl(), folders: folders.links };
}

/* ===== Tải file từ máy lên thư mục của một bước (VD 01_Brief) ===== */
function upload(req) {
  const name = String(req.name || 'file').replace(/[\\/]/g, '-').slice(0, 200);
  if (!req.data) throw new Error('File trống.');
  if (CLIENT_SUBS.indexOf(req.sub) < 0) throw new Error('Không rõ thư mục cần lưu.');
  const folders = clientFolders(req, String(req.client || 'Khách'), req.sub);
  const blob = Utilities.newBlob(Utilities.base64Decode(String(req.data)), req.mime || 'application/octet-stream', name);
  const f = folders.target.createFile(blob);
  return { ok: true, doc: { url: f.getUrl(), title: f.getName() }, folders: folders.links };
}

/* ===== Dữ liệu của website lưu trên Drive để mở máy nào cũng giống nhau ===== */
const DATA_NAME = 'han-workspace-data.json';
function dataFile() {
  const root = childFolder(DriveApp.getRootFolder(), ROOT_NAME()), it = root.getFilesByName(DATA_NAME);
  return { root, file: it.hasNext() ? it.next() : null };
}
function dataGet() {
  const f = dataFile().file;
  return { ok: true, data: f ? JSON.parse(f.getBlob().getDataAsString() || 'null') : null };
}
// Bản mới hơn thắng: nếu trên Drive đã có bản mới hơn (máy khác vừa lưu) thì không ghi đè, trả bản đó về
function dataSet(req) {
  const d = req.data;
  if (!d || !Array.isArray(d.clients)) throw new Error('Dữ liệu không hợp lệ.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { root, file } = dataFile();
    const cur = file ? JSON.parse(file.getBlob().getDataAsString() || 'null') : null;
    if (cur && (cur.t || 0) > (d.t || 0)) return { ok: true, stale: true, data: cur };
    const text = JSON.stringify(d);
    if (file) file.setContent(text); else root.createFile(DATA_NAME, text, 'application/json');
    return { ok: true, t: d.t };
  } finally { lock.releaseLock(); }
}

// Chuyển file vào Thùng rác Drive (khôi phục được trong 30 ngày).
// Chỉ xoá file nằm trong đúng thư mục của bước đó, để không xoá nhầm file khác.
function trash(req) {
  const m = String(req.url || '').match(/\/d\/([\w-]{10,})/) || String(req.url || '').match(/[?&]id=([\w-]{10,})/);
  if (!m) throw new Error('Không đọc được link file.');
  const file = DriveApp.getFileById(m[1]), dir = folderFrom(req.folder);
  if (!dir) throw new Error('Chưa có link thư mục của bước này nên không xoá được trên Drive.');
  let inside = false;
  const ps = file.getParents();
  while (ps.hasNext()) if (ps.next().getId() === dir.getId()) inside = true;
  if (!inside) throw new Error('File không nằm trong thư mục của bước này.');
  file.setTrashed(true);
  return { ok: true };
}

/* ===== Google Calendar (lịch chính của tài khoản chạy script) ===== */
function cal() { return CalendarApp.getDefaultCalendar(); }
function calEvent(e, tz) {
  const o = { id: e.getId(), title: e.getTitle(), allDay: e.isAllDayEvent(), location: e.getLocation(), description: e.getDescription(), recurring: e.isRecurringEvent() };
  if (o.allDay) {
    o.date = Utilities.formatDate(e.getAllDayStartDate(), tz, 'yyyy-MM-dd');
    o.endDate = Utilities.formatDate(new Date(e.getAllDayEndDate().getTime() - 864e5), tz, 'yyyy-MM-dd'); // ngày cuối (tính cả ngày đó)
  } else { o.start = e.getStartTime().toISOString(); o.end = e.getEndTime().toISOString(); }
  return o;
}
function calList(req) {
  const c = cal(), tz = c.getTimeZone();
  const from = new Date(req.from), to = new Date(req.to);
  if (isNaN(from) || isNaN(to)) throw new Error('Khoảng thời gian không hợp lệ.');
  return { ok: true, tz, events: c.getEvents(from, to).map(e => calEvent(e, tz)) };
}
function calFind(id) {
  const e = cal().getEventById(String(id || ''));
  if (!e) throw new Error('Không tìm thấy sự kiện (có thể đã bị xoá).');
  if (e.isRecurringEvent()) throw new Error('Đây là sự kiện lặp lại. Hãy sửa trong Google Calendar.');
  return e;
}
function calSave(req) {
  const c = cal(), tz = c.getTimeZone(), title = String(req.title || '').trim() || '(Không có tiêu đề)';
  const opts = { location: String(req.location || ''), description: String(req.description || '') };
  const day = s => Utilities.parseDate(String(s), tz, 'yyyy-MM-dd');
  let e;
  if (req.allDay) {
    if (!req.date) throw new Error('Chọn ngày.');
    const endEx = req.endDate && req.endDate > req.date ? new Date(day(req.endDate).getTime() + 864e5) : null;
    if (req.id) { e = calFind(req.id); endEx ? e.setAllDayDates(day(req.date), endEx) : e.setAllDayDate(day(req.date)); }
    else e = endEx ? c.createAllDayEvent(title, day(req.date), endEx, opts) : c.createAllDayEvent(title, day(req.date), opts);
  } else {
    const start = new Date(req.start), end = new Date(req.end);
    if (isNaN(start) || isNaN(end) || end <= start) throw new Error('Giờ kết thúc phải sau giờ bắt đầu.');
    if (req.id) { e = calFind(req.id); e.setTime(start, end); } else e = c.createEvent(title, start, end, opts);
  }
  if (req.id) { e.setTitle(title); e.setLocation(opts.location); e.setDescription(opts.description); }
  return { ok: true, event: calEvent(e, tz) };
}
function calDelete(req) { calFind(req.id).deleteEvent(); return { ok: true }; }

/* ===== Google Docs, Drive, Sheets ===== */
function today() { return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd-MM-yyyy HH:mm'); }

// Thư mục con của mỗi khách, giống trên website
const CLIENT_SUBS = ['00_Thong-tin', '01_Brief', '02_Tu-van', '03_Ke-hoach-setup', '04_So-ads-Meta', '05_Bao-cao'];

// Link thư mục Drive → thư mục (null nếu không mở được)
function folderFrom(link) {
  const m = String(link || '').match(/folders\/([\w-]+)/) || String(link || '').match(/[?&]id=([\w-]+)/);
  if (m) { try { return DriveApp.getFolderById(m[1]); } catch (err) { /* không mở được */ } }
  return null;
}

// Chọn thư mục lưu file của khách:
//  1. req.folder: link thư mục con đã có (VD 02_Tu-van) → lưu vào đó
//  2. req.clientFolder: link thư mục khách → lưu vào thư mục con <sub> bên trong (tự tạo nếu thiếu)
//  3. chưa có link → tự tạo "<ROOT_NAME>/Job chạy ads/<tên khách>" và 7 thư mục con
// Trả về thư mục đích và link các thư mục để website lưu lại vào hồ sơ khách.
function clientFolders(req, client, sub) {
  let clientDir = folderFrom(req.clientFolder);
  const direct = folderFrom(req.folder);
  if (!clientDir && !direct) {
    const name = String(client || 'Khách mới').replace(/[\/\\]/g, '-').trim() || 'Khách mới';
    clientDir = childFolder(childFolder(childFolder(DriveApp.getRootFolder(), ROOT_NAME()), 'Job chạy ads'), name);
  }
  const links = {};
  if (clientDir) {
    links.client = clientDir.getUrl();
    links.subs = {};
    CLIENT_SUBS.forEach(n => { links.subs[n] = childFolder(clientDir, n).getUrl(); });
  }
  const target = direct || childFolder(clientDir, sub);
  links.target = target.getUrl(); links.sub = sub;
  // Thư mục con khác của cùng khách (VD lưu brief vào 01_Brief khi đang lưu tư vấn vào 02_Tu-van)
  const other = (name, link) => folderFrom(link) || (clientDir ? childFolder(clientDir, name) : target);
  return { target, links, other };
}

// Lưu nguyên văn brief vào 01_Brief để lần sau xem lại
function saveBrief(req, folders, client, brief) {
  try { return writeDoc(`Brief - ${client} - ${today()}`, brief, folders.other('01_Brief', req.briefFolder)); }
  catch (err) { return null; }
}

// Google Docs sửa gần nhất trong một thư mục (VD bản tư vấn bạn vừa chỉnh trong 02_Tu-van)
function latestDoc(folderLink, docLink) {
  const dir = folderFrom(folderLink);
  let file = null;
  if (dir) {
    const it = dir.getFilesByType(MimeType.GOOGLE_DOCS);
    while (it.hasNext()) { const f = it.next(); if (!file || f.getLastUpdated() > file.getLastUpdated()) file = f; }
  }
  if (!file && docLink) { try { file = DriveApp.getFileById(DocumentApp.openByUrl(docLink).getId()); } catch (err) { /* bỏ qua */ } }
  if (!file) return null;
  return { title: file.getName(), url: file.getUrl(), text: DocumentApp.openById(file.getId()).getBody().getText().slice(0, 30000) };
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
  const ss = SpreadsheetApp.create(ROOT_NAME() + ' - Phân tích ads');
  DriveApp.getFileById(ss.getId()).moveTo(childFolder(DriveApp.getRootFolder(), ROOT_NAME()));
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
  Logger.log('Phiên bản code: ' + BACKEND_VERSION);
  Logger.log('AI đang dùng: ' + provider() + (provider() === 'gemini' ? ' (' + prop('GEMINI_MODEL', 'gemini-flash-latest') + ')' : ''));
  Logger.log('Trả lời: ' + ai('Trả lời ngắn gọn bằng tiếng Việt.', 'Chào bạn, hãy trả lời "Đã kết nối".'));
  Logger.log('Google Sheet: ' + sheetUrl());
  Logger.log('META_TOKEN: ' + (prop('META_TOKEN') ? 'đã có' : 'chưa có'));
  Logger.log('Google Calendar: ' + cal().getName() + ' (' + cal().getTimeZone() + ')');
}
