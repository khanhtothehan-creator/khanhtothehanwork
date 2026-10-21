/* ===== Cấu hình website =====
   Điền GOOGLE_CLIENT_ID sau khi tạo OAuth Client trong Google Cloud (xem README.md).
   Để trống thì nút Google Drive chỉ mở drive.google.com, không tạo thư mục. */
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: '',                 // ví dụ: '1234567890-abc.apps.googleusercontent.com'
  DRIVE_ROOT_NAME: "Han's Work Space", // thư mục gốc sẽ được tạo trong Drive của bạn
  BACKEND_URL: ''                       // địa chỉ Web app Apps Script (xem backend/HUONG-DAN.md), để trống thì nhập trên web
};
