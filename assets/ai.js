/* ===== Gọi backend Google Apps Script (Gemini/Claude + Meta + Google Docs/Sheets + Calendar + lưu dữ liệu) =====
   Link backend ghi sẵn trong config.js (BACKEND_URL), người dùng không phải nhập.
   Mã truy cập (APP_PASSCODE) nhập một lần ở màn hình đăng nhập, lưu trong trình duyệt, không nằm trong code. */
const AI = (() => {
  const CFG = window.APP_CONFIG || {};
  const UK = 'kws.backend', PK = 'kws.pass';
  const get = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } };
  const okUrl = u => /^https:\/\/script\.google(usercontent)?\.com\//.test(String(u || '').trim());

  // Link trong config.js được ưu tiên (mọi máy dùng chung); link lưu trong trình duyệt chỉ dùng khi config để trống
  const url = () => CFG.BACKEND_URL || get(UK) || '';
  // Có WEB_KEY trong config.js thì không cần nhập mã
  const key = () => get(PK) || CFG.WEB_KEY || '';
  const hasPass = () => !!key();
  const ready = () => !!url() && hasPass();
  const needLogin = () => { if (!CFG.WEB_KEY) window.dispatchEvent(new Event('kws-login')); };

  async function call(action, payload) {
    if (!url()) throw new Error('Web chưa được nối máy chủ.');
    if (!hasPass()) { needLogin(); throw new Error('Cần nhập mã truy cập.'); }
    let r;
    try {
      // text/plain để trình duyệt không gửi yêu cầu kiểm tra CORS trước (Apps Script không hỗ trợ)
      r = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action, key: key() }) });
    } catch (e) { throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); }
    const d = await r.json().catch(() => ({ ok: false, error: 'Máy chủ trả về dữ liệu lạ. Kiểm tra quyền truy cập Web app là "Bất kỳ ai".' }));
    if (!d.ok && d.error === 'unauthorized') { put(PK, ''); needLogin(); throw new Error(CFG.WEB_KEY ? 'Máy chủ chưa nhận khoá của web (máy chủ cần cập nhật bản mới).' : 'Mã truy cập không đúng.'); }
    // Backend chưa có chức năng này: Apps Script đang chạy bản code cũ
    if (!d.ok && /^Không rõ yêu cầu/.test(d.error || '')) throw new Error('Máy chủ đang chạy bản code cũ, cần triển khai lại Apps Script (xem trang #/cai-dat).');
    if (!d.ok) throw new Error(d.error || 'Có lỗi xảy ra.');
    return d;
  }

  // Đăng nhập: thử mã bằng một lần gọi ping
  async function login(code) {
    put(PK, String(code || '').trim());
    try { return await call('ping', {}); } catch (e) { put(PK, ''); throw e; }
  }
  const logout = () => put(PK, '');
  // Chỉ dùng ở trang cài đặt ẩn khi config.js chưa có link
  const setUrl = u => { if (!okUrl(u)) return false; put(UK, String(u).trim()); return true; };
  const fromConfig = () => !!CFG.BACKEND_URL;
  // Link rút gọn để so với link trong Apps Script (VD: .../s/AKfy...x7Q/exec)
  const short = () => { const m = url().match(/\/s\/([\w-]+)\//); return m ? '…/s/' + m[1].slice(0, 6) + '…' + m[1].slice(-6) + '/exec' : (url() || 'chưa nối'); };
  return { ready, hasPass, call, login, logout, url, setUrl, fromConfig, short };
})();
