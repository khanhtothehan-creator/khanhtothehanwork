# Hộp thư: thêm việc và lịch từ chat

File [`hop-thu.json`](hop-thu.json) là hộp thư của web. Khi bạn nhắn Claude kiểu
*"thêm vào lịch: thứ 7 hẹn cà phê lúc 19h với bạn cấp 1, chủ nhật có job cả ngày"*,
Claude thêm mục vào cuối danh sách `items` rồi commit lên nhánh `main`.

Máy chủ Apps Script đọc file này **5 phút một lần** (và mỗi lần mở web):

- mục `"type": "event"` → tạo sự kiện trong Google Calendar chính, hiện luôn ở mục **Lịch** của web;
- mục `"type": "todo"` → thêm vào **Việc cần làm** của web.

Không cần mở web, không dùng Google Drive/Docs. Mỗi mục có `id` riêng; id nào đã xử lý thì máy chủ
ghi nhớ và bỏ qua, nên sửa file hay chạy lại nhiều lần cũng không tạo trùng.

## Cách ghi một mục

```json
{
  "items": [
    { "id": "2026-10-24-ca-phe-cap-1", "type": "event", "title": "Hẹn cà phê với bạn cấp 1",
      "date": "2026-10-24", "start": "19:00", "end": "21:00", "location": "" },
    { "id": "2026-10-25-job", "type": "event", "title": "Job cả ngày", "date": "2026-10-25" },
    { "id": "2026-10-23-bao-gia-5th", "type": "todo", "title": "Gửi báo giá cho 5th season", "date": "2026-10-25" }
  ]
}
```

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `id` | có | Chuỗi không trùng, nên là `ngày-tên-ngắn`. **Không đổi id của mục cũ**, đổi là bị tạo lại. |
| `type` | có | `event` (lịch) hoặc `todo` (việc). |
| `title` | có | Tiêu đề sự kiện / nội dung việc. |
| `date` | event: có, todo: không | `YYYY-MM-DD` (hoặc `25/10`). Với việc là hạn chót. |
| `start`, `end` | không | `HH:MM`. Không có `start` = sự kiện cả ngày. Không có `end` = kéo dài 1 giờ. |
| `endDate` | không | Ngày kết thúc, cho sự kiện nhiều ngày hoặc qua đêm. |
| `location`, `note` | không | Địa điểm, ghi chú. |

Giờ tính theo múi giờ của Google Calendar (Asia/Ho_Chi_Minh).

Mục đã xử lý có thể xoá khỏi file cho gọn (xoá không làm mất sự kiện/việc đã tạo).
Sửa hoặc xoá sự kiện đã tạo thì làm trên web (mục **Lịch**) hoặc trong Google Calendar.
