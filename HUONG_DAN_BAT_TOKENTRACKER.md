# Hướng dẫn bật TokenTracker (kèm Cline + FreeBuff)

Hướng dẫn này áp dụng cho **bản fork** của bạn tại
`C:\Users\ADMIN\OneDrive\Máy tính\GitHub\TokenTracker`
— bản đã được thêm hỗ trợ **Cline** và **FreeBuff Desktop**.

---

## 1. Yêu cầu

- **Node.js ≥ 20** (máy bạn đang có `v22.23.2` — đạt yêu cầu).
- Các công cụ AI đã cài sẵn (để TokenTracker tự phát hiện):
  - **Cline** → dữ liệu ở `~/.cline/data/sessions/`
  - **FreeBuff Desktop** → dữ liệu ở `~/.config/freebuff-desktop/projects/`
  - Claude Code, Codex, Gemini CLI, OpenCode, Copilot, DSH, Hermes…

> **Quan trọng:** phải chạy lệnh từ **thư mục repo fork** (nơi chứa code mới nhất có Cline), **không** phải bản cài npm toàn cục.

```powershell
cd "C:\Users\ADMIN\OneDrive\Máy tính\GitHub\TokenTracker"
```

---

## 2. Cài dependencies (lần đầu)

Repo đang thiếu `node_modules` (đặc biệt là `dashboard/node_modules`), nên cần cài trước:

```powershell
# Cài dependencies của CLI chính
npm install

# Cài dependencies của dashboard (để mở giao diện web)
npm --prefix dashboard install
```

> Nếu `npm install` lỗi mạng, hãy kiểm tra proxy/VPN rồi thử lại.

---

## 3. Bật TokenTracker

### Cách 1 — Chạy trực tiếp từ repo (khuyến nghị)

```powershell
# Khởi tạo lần đầu (cài hook, phát hiện tool, mở dashboard tại http://localhost:7680)
node bin/tracker.js

# Hoặc dùng alias ngắn hơn:
node bin/tracker.js status     # xem trạng thái
node bin/tracker.js sync       # đồng bộ token
node bin/tracker.js doctor     # kiểm tra sức khỏe
```

### Cách 2 — Cài global (tùy chọn, để gõ lệnh ngắn)

```powershell
npm install -g .
tokentracker        # mở dashboard
tokentracker status # xem trạng thái
```

---

## 4. Xác minh Cline và FreeBuff đã được kết nối

Chạy lệnh sau và tìm 2 dòng này:

```powershell
node bin/tracker.js status --light
```

Kết quả mong đợi:

```
| Provider · freebuff  | installed, 10 files, projects  |
| Provider · cline     | installed, 5 files, sessions   |
```

Nếu thấy `installed` → đã kết nối thành công.
Nếu thấy `not installed` → kiểm tra lại đường dẫn dữ liệu (mục 6).

---

## 5. Đồng bộ token Cline / FreeBuff

```powershell
# Đồng bộ tất cả nguồn (bao gồm Cline + FreeBuff)
node bin/tracker.js sync

# Hoặc chỉ riêng Cline
node bin/tracker.js sync --source=cline

# Hoặc chỉ riêng FreeBuff
node bin/tracker.js sync --source=freebuff
```

Kết quả mong đợi (ví dụ):

```
Sync finished:
- Parsed files: 114
- New 30-min buckets queued: 3
- Uploaded: skipped (no device token)
```

> `Uploaded: skipped (no device token)` là **bình thường** — dữ liệu chỉ lưu local, không bị đẩy lên cloud.

---

## 6. Nếu không phát hiện được Cline / FreeBuff

Kiểm tra đường dẫn dữ liệu thực tế:

| Tool | Đường dẫn mặc định | Biến override |
|---|---|---|
| **Cline** | `~/.cline/data/sessions/*/*.messages.json` | `TOKENTRACKER_CLINE_HOME` |
| **FreeBuff** | `~/.config/freebuff-desktop/projects/*/desktop-v2.db` | `TOKENTRACKER_FREEBUFF_HOME` |

Nếu dữ liệu nằm chỗ khác, đặt biến môi trường trước khi chạy:

```powershell
$env:TOKENTRACKER_CLINE_HOME = "C:\đường\dẫn\đến\.cline"
$env:TOKENTRACKER_FREEBUFF_HOME = "C:\đường\dẫn\đến\freebuff-desktop"
node bin/tracker.js status --light
```

---

## 7. Mở Dashboard

Sau khi chạy `node bin/tracker.js`, mở trình duyệt:

```
http://localhost:7680
```

Dashboard sẽ hiển thị:
- Biểu đồ xu hướng token theo thời gian
- Phân tích theo model (vd `deepseek/deepseek-v4-flash` từ Cline)
- Chi phí ước tính
- Danh sách provider kèm icon (Cline, FreeBuff…)

---

## 8. Tóm tắt lệnh thường dùng

| Lệnh | Chức năng |
|---|---|
| `node bin/tracker.js` | Khởi tạo + mở dashboard |
| `node bin/tracker.js status` | Xem trạng thái các provider |
| `node bin/tracker.js status --light` | Bảng trạng thái dạng ASCII gọn |
| `node bin/tracker.js status --json` | Xuất JSON (cho script/AI) |
| `node bin/tracker.js sync` | Đồng bộ token từ mọi nguồn |
| `node bin/tracker.js sync --source=cline` | Đồng bộ riêng Cline |
| `node bin/tracker.js doctor` | Kiểm tra sức khỏe tổng thể |

---

## 9. Lưu ý

- **Dashboard cần `dashboard/node_modules`**: nếu chưa cài, chạy `npm --prefix dashboard install` trước.
- **ChatGPT VSCode extension** (`openai.chatgpt`) chưa được TokenTracker hỗ trợ (không expose log token local) — nên không track được.
- Các AI trong VSCode được hỗ trợ (Claude Code, Cline) thì đã track đầy đủ.
- Mọi thay đổi code đều nằm trong repo fork — hãy **commit** để giữ lại:
  ```powershell
  git add -A
  git commit -m "Add Cline + FreeBuff support"
  ```