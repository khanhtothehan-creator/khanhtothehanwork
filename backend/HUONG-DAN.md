# Cài đặt AI agent (Gemini miễn phí hoặc Claude + Meta Ads + Google Docs/Sheets)

Website trên GitHub Pages là trang tĩnh, không được chứa khoá bí mật. Vì vậy phần AI chạy trên
**Google Apps Script** (miễn phí, chạy bằng tài khoản Google của bạn). Website gửi brief hoặc link ads
tới đó, Apps Script gọi Claude, lấy số liệu Meta, tạo file Google Docs và ghi vào Google Sheet.

```
Website  →  Apps Script (giữ khoá)  →  Claude API
                                    →  Meta Marketing API (số liệu ads)
                                    →  Google Docs (file phân tích) + Google Sheet (bảng tổng hợp)
```

## Bước 1: Lấy khoá AI
- **Gemini (miễn phí):** vào https://aistudio.google.com/apikey → **Create API key** → copy khoá (bắt đầu bằng `AIza`).
  Gói miễn phí có giới hạn lượt dùng mỗi phút/ngày, và Google có thể dùng nội dung gửi lên để cải thiện sản phẩm: tránh dán thông tin nhạy cảm của khách.
- **Claude (trả phí, tuỳ chọn):** https://platform.claude.com → nạp credit → **API Keys → Create Key** (bắt đầu bằng `sk-ant-`).

Không gửi khoá cho ai và không dán vào code trên GitHub.

## Bước 2: Tạo Apps Script
1. Vào https://script.google.com → **New project** (Dự án mới), đặt tên `Khanh Workspace Backend`.
2. Xoá hết nội dung file `Code.gs` có sẵn, dán toàn bộ nội dung file [`backend/Code.gs`](Code.gs) vào, bấm 💾 lưu.
3. Bấm ⚙️ **Project Settings** (Cài đặt dự án) → kéo xuống **Script properties** → **Add script property**, thêm:
   | Property | Value |
   |---|---|
   | `GEMINI_API_KEY` | khoá `AIza...` ở bước 1 (hoặc `CLAUDE_API_KEY` nếu dùng Claude) |
   | `APP_PASSCODE` | một mã tự đặt, ví dụ `hoahong2026` (website sẽ hỏi mã này) |
   | `META_TOKEN` | để sau (bước 5), chưa có thì bỏ qua |
4. Quay lại **Editor** (<>), chọn hàm `kiemTra` ở thanh trên → bấm ▶ **Run**.
   Google hỏi quyền → **Review permissions** → chọn tài khoản → **Advanced** → **Go to ... (unsafe)** → **Allow**.
   Xem **Execution log**: thấy "AI đang dùng: gemini", câu trả lời "Đã kết nối" và link Google Sheet là xong.

## Bước 3: Đưa Apps Script lên làm Web app
1. Bấm **Deploy → New deployment** → bánh răng ⚙️ → chọn **Web app**.
2. **Execute as:** `Me`, **Who has access:** `Anyone` → **Deploy**.
3. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).

"Anyone" nghĩa là ai có link đều gửi yêu cầu được, nhưng không có `APP_PASSCODE` đúng thì script từ chối.

## Bước 4: Nối website
1. Mở website → **Job chạy ads** → khung **Phân tích brief với Claude** → bấm **Cài đặt AI**.
2. Dán Web app URL, rồi nhập `APP_PASSCODE`. Thấy thông báo "Đã kết nối backend" là xong.
   (Mỗi trình duyệt/máy nhập một lần.)

## Bước 5 (tuỳ chọn): Cho phép tự lấy số liệu Meta Ads
Chưa làm bước này vẫn phân tích được: mở ads trong hồ sơ khách → **Số liệu dán tay và ghi chú** → dán số liệu từ Ads Manager.

Muốn tự lấy số liệu:
1. Vào https://business.facebook.com/settings → **Users → System users** → **Add** (vai trò Admin).
2. **Assign assets**: chọn tài khoản quảng cáo của các khách, quyền **View performance** (xem hiệu quả).
3. **Generate new token** → chọn app (nếu chưa có app: tạo ở https://developers.facebook.com/apps loại **Business**) → tick quyền `ads_read` → thời hạn **Never** → **Generate**.
4. Copy token, thêm vào Script properties với tên `META_TOKEN`.

## Dùng
- **Brief → tư vấn:** Job chạy ads → chọn khách → dán brief → **Gửi Claude phân tích**. Claude viết tư vấn + báo giá,
  file Google Docs lưu vào thư mục `02_Tu-van` của khách (nếu đã dán link), và thêm một dòng vào tab "Tư vấn" của Google Sheet.
- **Ads → file phân tích:** hồ sơ khách → **+ Thêm ads** (dán link từ Ads Manager, link có `selected_ad_ids=...`).
  Bấm tên ads để mở ads trên Meta. Bấm **Phân tích**: Claude lấy số liệu, đánh giá, tạo file Google Docs trong `05_Bao-cao`
  và thêm một dòng vào tab "Phân tích ads" của Google Sheet (chi tiêu, CTR, CPM, kết quả, đề xuất...).
- Google Sheet tên **Khanh's Work Space - Phân tích ads** nằm trong thư mục `Khanh's Work Space` trên Drive.

## Đa tác tử
Ô **Cách chạy** trên web có 2 chế độ:
- **Đa tác tử** (mặc định):
  - Brief: ① Tiếp nhận → ② Chiến lược → ③ Nội dung + ④ Tracking (chạy song song) → ⑤ Tổng hợp.
    File tư vấn gồm bản gửi khách + phụ lục nội bộ (câu cần hỏi khách, toàn bộ mẫu nội dung, checklist tracking).
  - Ads: ① Lấy số liệu → ② Báo cáo → ③ Nội dung (mẫu mới) + ④ Kiểm duyệt (soát số liệu) → ⑤ Lưu file.
  - Mỗi brief dùng khoảng 5 lượt gọi AI, mất 1-3 phút. Bước nào lỗi (ví dụ Gemini quá tải) thì bấm lại nút, web chạy tiếp từ bước lỗi.
- **Nhanh**: 1 agent làm tất cả, khoảng 30 giây, tốn 1 lượt gọi.

Khung **Các agent của mục này** (cuối trang Job chạy ads) cho chọn model từng agent (Gemini hoặc Claude).
Chọn Claude mà chưa có `CLAUDE_API_KEY` thì agent đó tự dùng Gemini.

## Cài đặt thêm (Script properties, không bắt buộc)
| Property | Mặc định | Ý nghĩa |
|---|---|---|
| `AI_PROVIDER` | tự chọn | `gemini` hoặc `claude` (khi có cả hai khoá) |
| `GEMINI_MODEL` | `gemini-flash-latest` | Model Gemini; nếu không có, script tự chọn bản Flash đang hoạt động |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model Claude |
| `CLAUDE_EFFORT` | `medium` | `low` nhanh và rẻ hơn, `high` kỹ hơn nhưng lâu hơn |
| `META_API_VERSION` | `v23.0` | Phiên bản Meta Graph API |
| `SHEET_ID` | tự tạo | ID Google Sheet muốn ghi vào (lấy từ link `.../spreadsheets/d/<ID>/edit`) |

## Khi sửa `Code.gs`
Sau khi dán code mới: **Deploy → Manage deployments** → ✏️ → **Version: New version** → **Deploy**. Link Web app giữ nguyên.

## Lỗi thường gặp
- **"Sai mã truy cập"**: bấm lại, nhập đúng `APP_PASSCODE`.
- **"Gemini báo lỗi 400/403"**: khoá Gemini sai hoặc chưa bật. **"Gemini đang giới hạn lượt dùng"**: đợi 1 phút hoặc sang ngày mai.
- **"Claude báo lỗi 401"**: khoá API sai. **"402" / credit**: nạp thêm credit.
- **Chờ lâu rồi báo lỗi / Timeout**: đặt `CLAUDE_EFFORT` = `low`.
- **"Không lấy được số liệu Meta"**: token hết hạn hoặc system user chưa được gán tài khoản quảng cáo đó.
- **Không tạo được file trong thư mục khách**: link thư mục phải thuộc Drive của chính tài khoản chạy Apps Script (hoặc được chia sẻ quyền chỉnh sửa).
