/* ===== Han's Work Space: BỘ NẠP backend =====
   Dán file này vào Apps Script MỘT LẦN (thay toàn bộ code cũ), lưu, chạy kiemTra, triển khai.
   Bộ nạp tự lấy code backend mới nhất (backend/Code.gs) từ GitHub, nên khi code trên GitHub
   được cập nhật thì backend tự dùng bản mới sau vài phút, không phải dán code hay triển khai lại.
   Khoá bí mật (GEMINI_API_KEY, APP_PASSCODE, META_TOKEN...) vẫn để trong Script properties như cũ. */

const SRC = 'https://raw.githubusercontent.com/khanhtothehan-creator/khanhtothehanwork/main/backend/Code.gs';
const CACHE_SEC = 300; // giữ code 5 phút để chạy nhanh

// Lấy code: ưu tiên bản trong bộ nhớ đệm, rồi GitHub, cuối cùng là bản dự phòng đã lưu lần trước
function source_() {
  const cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  let code = cache.get('src');
  if (code) return code;
  try {
    const res = UrlFetchApp.fetch(SRC + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() === 200 && res.getContentText().indexOf('function doPost') >= 0) {
      code = res.getContentText();
      cache.put('src', code, CACHE_SEC);
      if (code.length < 300000) saveBackup_(props, code);
      return code;
    }
  } catch (err) { /* GitHub lỗi: dùng bản dự phòng */ }
  code = loadBackup_(props);
  if (!code) throw new Error('Không tải được code backend từ GitHub.');
  return code;
}
// Script property giới hạn 9KB mỗi ô, nên chia nhỏ để lưu bản dự phòng
function saveBackup_(props, code) {
  const parts = code.match(/[\s\S]{1,8000}/g), o = { SRC_N: String(parts.length) };
  parts.forEach((p, i) => { o['SRC_' + i] = p; });
  props.setProperties(o);
}
function loadBackup_(props) {
  const n = +props.getProperty('SRC_N') || 0;
  let code = '';
  for (let i = 0; i < n; i++) code += props.getProperty('SRC_' + i) || '';
  return code;
}
// Chạy một hàm trong code backend vừa nạp
function run_(name, arg) {
  const fn = new Function(source_() + '\nreturn ' + name + ';')();
  return fn(arg);
}

function doPost(e) { return run_('doPost', e); }
function doGet(e) { return run_('doGet', e); }
function kiemTra() { return run_('kiemTra'); }
// Bấm chạy hàm này khi muốn dùng ngay code mới trên GitHub (không chờ 5 phút)
function napLai() { CacheService.getScriptCache().remove('src'); Logger.log('Đã xoá bộ nhớ đệm. Lần gọi tới sẽ lấy code mới từ GitHub.'); kiemTra(); }

// Không bao giờ chạy. Chỉ để Google biết backend cần những quyền nào (Drive, Docs, Sheets, Calendar, kết nối ngoài).
function quyen_() {
  DriveApp.getRootFolder(); DocumentApp.create(''); SpreadsheetApp.create(''); CalendarApp.getDefaultCalendar();
  UrlFetchApp.fetch(''); LockService.getScriptLock(); MimeType.GOOGLE_DOCS;
}
