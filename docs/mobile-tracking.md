# Theo dõi token trên điện thoại (iPhone & Android)

Token Tracker là một Progressive Web App (PWA) — bạn có thể **cài đặt nó lên màn hình chính
của cả iPhone và Android** như một ứng dụng thật, và xem số token đã đồng bộ từ máy tính
của mình ở bất cứ đâu.

## Nguyên lý hoạt động

```
Máy tính (CLI) ──cloud sync──▶ Tài khoản Token Tracker ◀──điện thoại (đọc)
   queue.jsonl                  (InsForge cloud)              PWA / trình duyệt
```

- Máy tính của bạn thu thập token cục bộ rồi **upload lên tài khoản cloud** (tùy chọn, mặc định bật).
- Điện thoại truy cập **https://www.tokentracker.cc** bằng cùng tài khoản để xem số liệu.
- Dữ liệu chỉ là số token / chi phí / mô hình — **không bao giờ** chứa prompt hay nội dung hội thoại.

## Bước 0 — Chuẩn bị (chỉ làm 1 lần trên máy tính)

1. Mở dashboard cục bộ: `http://localhost:7680`.
2. Vào **Settings → Account**.
3. Bật **Cloud sync** (nếu chưa bật) và **đăng nhập** tài khoản của bạn.
4. Đợi vài giây để dữ liệu được upload (hoặc bấm Refresh / chạy `tracker sync`).

> Lưu ý: Cloud sync chỉ upload số liệu khi máy tính đang chạy và có mạng. Muốn số liệu
> luôn mới, hãy để CLI (hoặc app macOS/Windows) chạy nền trên máy tính.

---

## 📱 Cài đặt trên iPhone (Safari)

1. Mở **Safari** trên iPhone.
2. Truy cập **https://www.tokentracker.cc**.
3. Đăng nhập bằng tài khoản Token Tracker của bạn (giống trên máy tính).
4. Bấm nút **Chia sẻ** (hình vuông mũi tên lên) ở cuối màn hình.
5. Cuộn xuống và chọn **“Thêm vào Màn hình chính”** (Add to Home Screen).
6. Bấm **Thêm** (Add). Icon Token Tracker sẽ xuất hiện trên màn hình chính.
7. Mở app từ icon đó — nó sẽ chạy **toàn màn hình** như một ứng dụng thật, không có thanh địa chỉ.

## 🤖 Cài đặt trên Android (Chrome)

1. Mở **Chrome** trên điện thoại Android.
2. Truy cập **https://www.tokentracker.cc**.
3. Đăng nhập bằng tài khoản Token Tracker của bạn.
4. Bấm menu **⋮** (ba chấm) ở góc phải trên.
5. Chọn **“Thêm vào Màn hình chính”** (Add to Home screen) — hoặc **“Cài đặt ứng dụng”**
   (Install app) nếu Chrome hiển thị tùy chọn này.
6. Bấm **Cài đặt** (Install). Icon Token Tracker sẽ xuất hiện trên màn hình chính.
7. Mở app từ icon đó — nó sẽ chạy toàn màn hình như một ứng dụng thật.

---

## ✨ Remote Connection — quét QR để mở ngay trên điện thoại

Không cần gõ URL — mở app/dashboard, vào **Settings → Remote Connection**, QR hiện ra ngay lập tức. Quét là mở:

1. Trên dashboard (máy tính), vào **Settings → Remote Connection**.
2. **QR code hiện ngay** — dùng camera điện thoại quét.
3. Điện thoại mở thẳng **www.tokentracker.cc**.
4. Đăng nhập một lần (nếu chưa từng) → thấy ngay số token đã đồng bộ.

> Mã QR chỉ chứa URL công khai của dashboard — **không** chứa token hay mật khẩu, nên an toàn khi quét/chụp/chia sẻ.

## 🌐 Dùng tên miền riêng của bạn

Ngoài `tokentracker.cc`, bạn có thể dùng **tên miền của chính mình** để mở dashboard — QR sẽ trỏ về domain của bạn.

**Trong dashboard:**
1. Mở **Settings → Remote Connection**.
2. Ở ô **“Your domain (optional)”**, gõ tên miền của bạn (ví dụ `token.example.com`).
3. QR tự động đổi sang domain đó và được lưu lại cho lần sau.
4. Để quay lại mặc định, chỉ cần xóa nội dung ô nhập.

> Mã QR chỉ chứa URL công khai — **không** chứa token hay mật khẩu, nên an toàn khi quét/chụp/chia sẻ.

**Trỏ tên miền về dashboard (cần làm 1 lần ở nhà cung cấp tên miền + Vercel):**
1. Vào **Vercel → dự án Token Tracker → Settings → Domains**, thêm tên miền của bạn.
2. Tại nhà cung cấp tên miền (nơi bạn mua domain), thêm bản ghi DNS:
   - **Subdomain** (vd `token.example.com`): bản ghi **CNAME** trỏ tới `cname.vercel-dns.com`.
   - **Domain gốc** (vd `example.com`): bản ghi **A** trỏ tới `76.76.21.21`.
3. Vercel tự cấp chứng chỉ SSL (HTTPS) — đợi vài phút cho DNS lan truyền.
4. Khi domain đã hoạt động, nhập nó vào ô **“Your domain (optional)”** và quét QR.

## Mẹo

- **Xem nhanh**: sau khi cài đặt, chỉ cần chạm icon Token Tracker để mở thẳng dashboard.
- **Luôn mới**: app tự tải dữ liệu mới mỗi lần mở. Nếu muốn số liệu cập nhật liên tục,
  hãy đảm bảo CLI/app desktop đang chạy nền trên máy tính và đã bật cloud sync.
- **Offline**: app shell (giao diện) được cache để mở nhanh; nhưng số liệu token cần mạng
  vì chúng được lấy từ cloud.

## Khắc phục sự cố

| Vấn đề | Cách xử lý |
|---|---|
| Không thấy số liệu trên điện thoại | Kiểm tra **Cloud sync** đã bật trên máy tính, đã đăng nhập cùng tài khoản, và đã chạy `tracker sync` |
| Số liệu cũ | Mở lại app (kéo xuống để refresh), đảm bảo máy tính đang chạy và có mạng |
| Không thấy tùy chọn “Thêm vào Màn hình chính” | Cập nhật Safari/Chrome lên phiên bản mới nhất; mở lại trang và đợi vài giây |
| Đã cài nhưng mở ra vẫn là trang web | Xóa app cũ khỏi màn hình chính rồi cài lại (phiên bản mới có PWA) |

## Ghi chú kỹ thuật

- PWA gồm: `manifest.webmanifest`, service worker (`sw.js`), icon 192/512 + maskable + `apple-touch-icon`.
- Service worker chỉ cache app shell và tài nguyên tĩnh; **không bao giờ** cache các endpoint
  dữ liệu (`/functions/*`, `/api/*`) để số token luôn mới và không làm hỏng luồng OAuth.
- Service worker không được đăng ký bên trong webview của app macOS/Windows native.