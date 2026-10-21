/* ===== Gọi backend Google Apps Script (Gemini/Claude + Meta + Google Docs/Sheets) =====
   Địa chỉ backend lấy từ config.js (BACKEND_URL) hoặc từ nút "Cài đặt AI" (lưu trong trình duyệt).
   Mã truy cập (APP_PASSCODE) chỉ lưu trong trình duyệt, không nằm trong code trên GitHub. */
const AI = (() => {
  const CFG = window.APP_CONFIG || {};
  const UK = 'kws.backend', PK = 'kws.pass';
  const get = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } };

  const url = () => get(UK) || CFG.BACKEND_URL || '';
  const ready = () => !!url() && !!get(PK);

  // Hỏi địa chỉ backend và mã truy cập. Trả về false nếu người dùng huỷ.
  function setup(force) {
    if (force || !url()) {
      const u = prompt('Dán địa chỉ Web app của Google Apps Script (dạng https://script.google.com/macros/s/.../exec):', url());
      if (u === null) return false;
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u.trim())) { alert('Địa chỉ phải bắt đầu bằng https://script.google.com/'); return false; }
      put(UK, u.trim());
    }
    if (force || !get(PK)) {
      const p = prompt('Nhập mã truy cập (APP_PASSCODE bạn đặt trong Apps Script):', '');
      if (p === null || !p.trim()) return false;
      put(PK, p.trim());
    }
    return true;
  }

  async function call(action, payload) {
    if (!ready() && !setup(false)) throw new Error('Chưa cài đặt AI.');
    let r;
    try {
      // text/plain để trình duyệt không gửi yêu cầu kiểm tra CORS trước (Apps Script không hỗ trợ)
      r = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action, key: get(PK) }) });
    } catch (e) { throw new Error('Không kết nối được backend. Kiểm tra lại địa chỉ Web app.'); }
    const d = await r.json().catch(() => ({ ok: false, error: 'Backend trả về dữ liệu lạ. Kiểm tra quyền truy cập Web app là "Anyone".' }));
    if (!d.ok && d.error === 'unauthorized') { put(PK, ''); throw new Error('Sai mã truy cập. Bấm lại để nhập mã mới.'); }
    // Backend chưa có chức năng này: Apps Script đang chạy bản code cũ
    if (!d.ok && /^Không rõ yêu cầu/.test(d.error || '')) throw new Error('Link Web app đang dùng chạy bản code cũ (' + short() + '). Tạo bản triển khai mới rồi nối lại link: xem "⚙️ Cài đặt AI" ở cuối trang Job chạy ads.');
    if (!d.ok) throw new Error(d.error || 'Có lỗi xảy ra.');
    return d;
  }

  // Link rút gọn để so với link trong Apps Script (VD: .../s/AKfy...x7Q/exec)
  const short = () => { const m = url().match(/\/s\/([\w-]+)\//); return m ? '…/s/' + m[1].slice(0, 6) + '…' + m[1].slice(-6) + '/exec' : (url() || 'chưa nối'); };
  // Lưu link backend nhận từ link kết nối (mở web trên máy khác)
  const setUrl = u => { u = String(u || '').trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return false; put(UK, u); return true; };
  return { ready, setup, call, url, short, setUrl };
})();
