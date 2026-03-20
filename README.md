# 🚀 Echoo - The Emotional Dumpster

**Echoo** không định vị là một mạng xã hội. Echoo là một "thùng rác cảm xúc" – nơi mọi người đến để trút bỏ những bí mật thầm kín nhất, tìm thấy sự đồng cảm và rời đi.

> **Trạng thái dự án:** Đang nâng cấp hệ thống phân phối nội dung (Batching V2). Bản Demo tạm thời đóng để bảo trì.

---

## 💡 Triết lý Sản phẩm (Product Strategy)

Echoo đi ngược lại với các MXH truyền thống để bảo vệ trải nghiệm người dùng:
* **Vô hiệu hóa Comment:** Triệt tiêu hoàn toàn sự độc hại (Toxic). Người dùng được công nhận qua Reaction mà không sợ bị tấn công bằng lời nói.
* **Contribution Barrier:** Để ngăn chặn Bot, người dùng phải đóng góp 1 Confession để "mở khóa" quyền tương tác mãi mãi. 
* **The Ladder Rule:** Thuật toán phân phối ưu tiên **HOT → NEW → OLD**, đảm bảo bài mới luôn có đất diễn.

---

## 🏗️ Kiến trúc Hệ thống (System Architecture)

Hệ thống được thiết kế để vận hành với **chi phí $0/tháng** nhưng vẫn có khả năng mở rộng (Scalability) cao:

* **Frontend:** React/Next.js tối ưu 60fps trên mobile, cảm giác "vuốt" mượt mà như TikTok.
* **Backend:** Serverless với **Supabase (PostgreSQL)**.
* **Edge Logic:** Sử dụng **PostgreSQL RPC** để lọc bài đã xem (`seen-id`) ngay tại Database, giảm 70% băng thông.
* **Security:** Bảo mật tuyệt đối qua **Row Level Security (RLS)**, không lưu thông tin định danh.

---

## 🛠️ Quyết định Kỹ thuật (Technical Decisions)

| Tính năng | Giải pháp | Lý do |
| :--- | :--- | :--- |
| **Zero-Latency Feed** | Batch-prefetching | Triệt tiêu trạng thái "Loading", thuật toán O(n) đảm bảo lướt nghìn bài không lag. |
| **Stateless Privacy** | LocalStorage-based | Loại bỏ Database User để đảm bảo ẩn danh thực thụ. |
| **AI Content Pipeline** | Gemini + Claude | Sản xuất 50-100 bài/tuần với chất lượng đồng nhất, tiết kiệm 80% sức lao động. |

---

## 📈 Kết quả & Bài học (The Pivot)

* **MVP Cost:** ~$50 (bao gồm Domain & Marketing). Chi phí vận hành cố định: **$0**.
* **Metric:** Đạt 33 lượt view đầu tiên trong tuần đầu ra mắt.
* **Bài học:** "Cứ bắt tay vào làm cái đã". Echoo là kết quả sau 4 sản phẩm thất bại trước đó. 

---

## 💻 Cài đặt (Local)

1. `git clone https://github.com/nomnom58/untold.git`
2. `npm install`
3. Tạo file `.env.local` với `SUPABASE_URL` và `SUPABASE_ANON_KEY`.
4. `npm run dev`