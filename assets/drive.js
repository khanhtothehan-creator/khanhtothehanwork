/* ===== Google Drive: đăng nhập, tạo thư mục từng khách, đếm file =====
   Dùng Google Identity Services (lấy access token) + Drive REST API v3, không cần server.
   Cây thư mục: <DRIVE_ROOT_NAME> / Job chạy ads / <Tên khách> / 00_Thong-tin ... 06_Nhat-ky-toi-uu */
const Drive = (() => {
  const CFG = window.APP_CONFIG || {};
  const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';
  const API = 'https://www.googleapis.com/drive/v3/files';
  const FOLDER = 'application/vnd.google-apps.folder';
  const TK = 'kws.drive.token', IDS = 'kws.drive.ids';

  const store = {
    get(k, s) { try { return JSON.parse((s || localStorage).getItem(k)); } catch (e) { return null; } },
    set(k, v, s) { try { (s || localStorage).setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
    del(k, s) { try { (s || localStorage).removeItem(k); } catch (e) { /* bỏ qua */ } }
  };
  let token = (() => { const t = store.get(TK, sessionStorage); return t && t.exp > Date.now() ? t : null; })();
  let client = null;
  const ids = store.get(IDS) || {}; // cache: đường dẫn thư mục -> id

  const configured = () => !!CFG.GOOGLE_CLIENT_ID;
  const connected = () => !!token && token.exp > Date.now();
  const folderUrl = id => `https://drive.google.com/drive/folders/${id}`;

  function waitGis() {
    return new Promise((ok, no) => {
      let n = 0;
      (function check() {
        if (window.google && google.accounts && google.accounts.oauth2) return ok();
        if (++n > 50) return no(new Error('Không tải được Google Sign-In.'));
        setTimeout(check, 100);
      })();
    });
  }

  async function connect(silent) {
    if (!configured()) throw new Error('Chưa điền GOOGLE_CLIENT_ID trong config.js.');
    await waitGis();
    return new Promise((ok, no) => {
      if (!client) {
        client = google.accounts.oauth2.initTokenClient({ client_id: CFG.GOOGLE_CLIENT_ID, scope: SCOPES, callback: () => {} });
      }
      client.callback = r => {
        if (r.error) return no(new Error(r.error_description || r.error));
        token = { v: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
        store.set(TK, token, sessionStorage);
        ok();
      };
      client.error_callback = e => no(new Error(e.message || 'Đăng nhập bị huỷ.'));
      client.requestAccessToken({ prompt: silent ? '' : (connected() ? '' : 'consent') });
    });
  }

  function disconnect() {
    if (token && window.google) google.accounts.oauth2.revoke(token.v, () => {});
    token = null; store.del(TK, sessionStorage);
  }

  async function api(url, opt = {}) {
    if (!connected()) await connect(true);
    const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token.v, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
    if (r.status === 401) { token = null; store.del(TK, sessionStorage); throw new Error('Phiên Google đã hết hạn, hãy kết nối lại.'); }
    if (!r.ok) throw new Error('Drive báo lỗi ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  }

  const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  // Tìm thư mục theo tên trong thư mục cha, chưa có thì tạo.
  async function ensureFolder(name, parent, path) {
    if (ids[path]) {
      try { const f = await api(`${API}/${ids[path]}?fields=id,trashed`); if (!f.trashed) return f.id; } catch (e) { /* tạo lại bên dưới */ }
    }
    const where = `name='${q(name)}' and mimeType='${FOLDER}' and trashed=false and '${parent || 'root'}' in parents`;
    const found = await api(`${API}?q=${encodeURIComponent(where)}&fields=files(id)&pageSize=1`);
    const id = found.files.length ? found.files[0].id
      : (await api(API + '?fields=id', { method: 'POST', body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent || 'root'] }) })).id;
    ids[path] = id; store.set(IDS, ids);
    return id;
  }

  async function root() {
    const name = CFG.DRIVE_ROOT_NAME || "Khanh's Work Space";
    return ensureFolder(name, null, name);
  }

  // Tạo (hoặc tìm lại) thư mục khách và các thư mục con. Trả về { id, subs: [{ name, id }] }.
  async function ensureClient(moduleName, clientName, subNames) {
    const r = await root();
    const m = await ensureFolder(moduleName, r, 'm/' + moduleName);
    const c = await ensureFolder(clientName, m, 'c/' + moduleName + '/' + clientName);
    const subs = [];
    for (const s of subNames) subs.push({ name: s, id: await ensureFolder(s, c, 'c/' + moduleName + '/' + clientName + '/' + s) });
    return { id: c, subs };
  }

  // Số file (không tính thư mục) nằm trực tiếp trong mỗi thư mục, gọi một lần cho cả danh sách.
  async function countFiles(folderIds) {
    const counts = Object.fromEntries(folderIds.map(id => [id, 0]));
    const where = `(${folderIds.map(id => `'${id}' in parents`).join(' or ')}) and trashed=false and mimeType!='${FOLDER}'`;
    let page = '';
    do {
      const r = await api(`${API}?q=${encodeURIComponent(where)}&fields=nextPageToken,files(parents)&pageSize=1000${page ? '&pageToken=' + page : ''}`);
      r.files.forEach(f => (f.parents || []).forEach(p => { if (p in counts) counts[p]++; }));
      page = r.nextPageToken;
    } while (page);
    return counts;
  }

  return { configured, connected, connect, disconnect, root, ensureClient, countFiles, folderUrl };
})();
