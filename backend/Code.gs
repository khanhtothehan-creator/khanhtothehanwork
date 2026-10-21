/* ===== Khanh's Work Space: backend chạy trên Google Apps Script =====
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

const PROPS = PropertiesService.getScriptProperties();
const prop = (k, d) => PROPS.getProperty(k) || d;

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'Yêu cầu không hợp lệ.' }); }
  if (!prop('APP_PASSCODE') || req.key !== prop('APP_PASSCODE')) return out({ ok: false, error: 'unauthorized' });
  try {
    if (req.action === 'ping') return out({ ok: true, meta: !!prop('META_TOKEN'), provider: provider() });
    if (req.action === 'consult') return out(consult(req));
    if (req.action === 'analyzeAd') return out(analyzeAd(req));
    // Đa tác tử: website gọi từng agent rồi gọi bước lưu
    if (req.action === 'agent') return out(runAgent(req));
    if (req.action === 'consultSave') return out(consultSave(req));
    if (req.action === 'adData') return out(adData(req));
    if (req.action === 'adSave') return out(adSave(req));
    return out({ ok: false, error: 'Không rõ yêu cầu: ' + req.action });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err) });
  }
}
function doGet() { return out({ ok: true, app: "Khanh's Work Space backend" }); }
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
  // Model đang quá tải: thử lần lượt các model Flash khác
  if (res.code === 503 || res.code === 500) {
    for (const m of geminiModels(key).filter(x => x !== model).slice(0, 4)) {
      res = geminiRetry(m, body, key);
      if (res.code === 200 || res.code === 400) { model = m; break; }
    }
  }
  // Schema không được hỗ trợ: thử lại, chỉ yêu cầu trả JSON
  if (res.code === 400 && schema) { delete body.generationConfig.responseSchema; res = geminiFetch(model, body, key); }
  const data = res.data;
  if (res.code === 429) throw new Error('Gemini đang giới hạn lượt dùng miễn phí. Đợi 1 phút (hoặc sang ngày mai nếu hết lượt trong ngày) rồi thử lại.');
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
  const text = ai(CONSULT_SYSTEM, `Tên khách: ${client}\n\nBrief và yêu cầu của khách:\n${brief}`);
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

// Gom dữ liệu một mẫu ads: số liệu Meta (nếu có token) + số liệu Khanh dán tay
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
  const doc = writeDoc(`Phân tích ads - ${client} - ${name} - ${today()}`, head + '\n' + body, folderFrom(req.folder, 'Phân tích ads'));
  logRow('Phân tích ads',
    ['Thời gian', 'Khách', 'Tên ads', 'ID ads', 'Đánh giá', 'Chi tiêu', 'Hiển thị', 'CTR', 'CPM', 'Kết quả', 'Chi phí/kết quả', 'Tóm tắt', 'Đề xuất', 'File phân tích', 'Link ads'],
    [new Date(), client, name, input.ad_id, r.danh_gia, r.chi_tieu, r.hien_thi, r.ctr, r.cpm, r.ket_qua, r.chi_phi_moi_ket_qua, r.tom_tat, r.de_xuat.join('\n'), doc.url, req.url || '']);
  return { doc, sheet: sheetUrl(), name };
}

function analyzeAd(req) {
  const { input, metaNote } = adInput(req);
  const r = fillAd(ai(AD_SYSTEM, adPrompt(input), AD_SCHEMA));
  const f = adFinish(req, input, r, r.bao_cao_markdown);
  return { ok: true, result: r, doc: f.doc, sheet: f.sheet, metaNote, name: f.name };
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
const ROLE = 'Bạn là một agent trong nhóm trợ lý chạy quảng cáo Meta Ads (Facebook, Instagram) của Khanh, freelancer làm cho shop, spa, quán, studio nhỏ ở Việt Nam. ';
const T = (label, v) => v ? `\n\n### ${label}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}` : '';

const AGENT_DEFS = {
  tiep_nhan: {
    system: ROLE + 'Vai trò: agent Tiếp nhận. Đọc brief, chuẩn hoá thông tin. Các phần: ## Tóm tắt brief (sản phẩm/dịch vụ, khách hàng mục tiêu, mục tiêu kinh doanh, ngân sách, thời gian, khu vực, kênh nhận khách), ## Thông tin còn thiếu (câu hỏi cụ thể để Khanh hỏi lại khách), ## Giả định tạm thời. ' + MD_RULE,
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
  const doc = writeDoc(title, text + appendix.replace(/^### /gm, '## '), folderFrom(req.folder, 'Tư vấn'));
  logRow('Tư vấn', ['Thời gian', 'Khách', 'Brief (rút gọn)', 'File tư vấn'], [new Date(), client, String(i.brief).slice(0, 300), doc.url]);
  return { ok: true, provider: used, text, doc, sheet: sheetUrl() };
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
  return { ok: true, doc: f.doc, sheet: f.sheet, name: f.name };
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
  Logger.log('AI đang dùng: ' + provider() + (provider() === 'gemini' ? ' (' + prop('GEMINI_MODEL', 'gemini-flash-latest') + ')' : ''));
  Logger.log('Trả lời: ' + ai('Trả lời ngắn gọn bằng tiếng Việt.', 'Chào bạn, hãy trả lời "Đã kết nối".'));
  Logger.log('Google Sheet: ' + sheetUrl());
  Logger.log('META_TOKEN: ' + (prop('META_TOKEN') ? 'đã có' : 'chưa có'));
}
