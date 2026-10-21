# Han's Work Space

Website tĩnh (HTML/CSS/JS, không cần server), có nối Google Drive.

```
index.html          trang chính
config.js           điền Google Client ID ở đây
assets/style.css    giao diện
assets/app.js       dữ liệu + điều hướng (link dạng /#/ads/shop-mau-e)
assets/drive.js     đăng nhập Google, tạo thư mục, đếm file
assets/ai.js        gọi backend AI (Claude)
backend/Code.gs     backend Google Apps Script: Claude + Meta Ads + Google Docs/Sheets
assets/img/         ảnh sticker
```

## 1. Chạy thử trên máy

```bash
cd khanh-workspace
python3 -m http.server 8000
```
Mở http://localhost:8000 (Google không cho đăng nhập khi mở file trực tiếp bằng `file://`).

## 2. Đưa lên mạng (miễn phí, chọn 1)

- **Netlify Drop**: vào https://app.netlify.com/drop, kéo thả cả thư mục `khanh-workspace`. Có link ngay.
- **GitHub Pages**: tạo repo, upload các file, vào Settings → Pages → Branch `main` → Save.
- **Vercel**: Import repo GitHub, Framework = Other, bấm Deploy.

Ghi lại địa chỉ website, ví dụ `https://khanh-workspace.netlify.app`.

## 3. Nối Google Drive

1. Vào https://console.cloud.google.com → tạo project mới (ví dụ "Khanh Work Space").
2. **APIs & Services → Library** → tìm **Google Drive API** → Enable.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type: **External**, điền tên app + email của bạn.
   - Scopes: thêm `.../auth/drive.file` và `.../auth/drive.metadata.readonly`.
   - **Test users**: thêm Gmail của bạn (để ở chế độ Testing là đủ cho dùng cá nhân).
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: thêm địa chỉ website (bước 2) và `http://localhost:8000`.
5. Copy **Client ID** dán vào `config.js`:
   ```js
   GOOGLE_CLIENT_ID: '1234567890-abc.apps.googleusercontent.com',
   ```
6. Đưa lại file lên hosting.

### Website làm gì với Drive

- Nút **Google Drive** ở đầu trang: đăng nhập và mở thư mục gốc `Han's Work Space` trong Drive.
- Trong hồ sơ một khách (Job chạy ads → bấm vào khách) → **Kết nối và tạo thư mục trên Drive**:
  tạo `Han's Work Space / Job chạy ads / <Tên khách> / 00_Thong-tin ... 06_Nhat-ky-toi-uu`
  (đã có thì dùng lại, không tạo trùng), rồi hiện số file thật trong từng thư mục và nút **Mở Drive ↗**.
- Quyền xin: tạo/sửa file do website tạo ra + xem tên file (không đọc nội dung file khác của bạn).
- Không lưu mật khẩu; token đăng nhập chỉ giữ trong tab trình duyệt (khoảng 1 giờ).

## 4. Tạo khách và gắn link Drive ngay trên web

- Vào **Job chạy ads** → thẻ **+ Tạo thư mục khách** → điền tên khách, dán link thư mục Drive → **Tạo thư mục**.
- Bấm vào thẻ khách để mở hồ sơ: nút **Mở thư mục Drive ↗**, ô sửa link, đổi giai đoạn/ghi chú, xoá khách.
- Mỗi thư mục con (01_Brief, 02_Tu-van...) có ô dán link riêng ở cuối thẻ, dán xong link tự lưu.
- Dữ liệu lưu trong trình duyệt. Khi đã nối Google Drive (Client ID), dữ liệu tự lưu thêm vào file
  `khanh-workspace-data.json` trong thư mục `Han's Work Space` để mở trên máy khác vẫn thấy.

## 5. AI agent: phân tích brief và ads với Claude

- **Brief → tư vấn:** Job chạy ads → khung **Phân tích brief với Claude**.
- **Ads Meta:** trong hồ sơ khách → **+ Thêm ads** (dán link Ads Manager) → bấm tên để mở ads, bấm **Phân tích** để
  Claude tạo file phân tích (Google Docs) và cập nhật Google Sheet.
- Cài đặt (khoá Claude API, Apps Script, token Meta): xem [`backend/HUONG-DAN.md`](backend/HUONG-DAN.md).

## 6. Sửa dữ liệu

Danh sách khách, ads, trường... nằm đầu file `assets/app.js` (`CLIENTS`, `SCHOOLS`, `MODULES`). Hiện vẫn là dữ liệu ví dụ.
