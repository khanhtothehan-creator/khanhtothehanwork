/* ===== Cấu hình website =====
   Điền GOOGLE_CLIENT_ID sau khi tạo OAuth Client trong Google Cloud (xem README.md).
   Để trống thì nút Google Drive chỉ mở drive.google.com, không tạo thư mục. */
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: '',                 // ví dụ: '1234567890-abc.apps.googleusercontent.com'
  DRIVE_ROOT_NAME: "Han's Work Space", // thư mục gốc sẽ được tạo trong Drive của bạn
  WEB_KEY: 'han-ws-7f3k9q2m',          // khoá chung với backend (WEB_KEY trong backend/Code.gs), để web không phải hỏi mã
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbxT8oVaNb25DupG_rla6CR-BBfjktvMKgBIeafu-J8yBKnah1mCBn8sprJOg34UGUfyXw/exec'                       // link Web app Apps Script (đuôi /exec). Không phải mật khẩu: web vẫn hỏi mã truy cập
};
