# 🚀 Echoo - The Emotional Dumpster

**Echoo** is not a social network. It is an "emotional dumpster" — a safe haven where people come to offload their deepest secrets, find silent empathy, and move on.

> **Project Status:** Currently upgrading the distribution engine (**Batching V2**). Live Demo is temporarily in maintenance mode for database optimization.

---

## 💡 Product Philosophy (Strategy)

Echoo challenges traditional social media norms to protect the user experience:
* **Zero Comments:** Eliminates toxicity and drama at the source. Users receive validation through reactions without the fear of verbal attacks.
* **Contribution Barrier:** To prevent bots and ensure community quality, users must post one confession to "unlock" the ability to react forever.
* **The Ladder Rule:** A distribution algorithm that prioritizes **HOT (Engagement) → NEW (Freshness) → OLD**, ensuring new voices always have a stage while quality content remains visible.

---

## 🏗️ System Architecture

Designed for **$0/month operational cost** while maintaining high scalability:

* **Frontend:** React/Next.js optimized for 60fps on mobile, delivering a "frictionless swipe" experience inspired by TikTok.
* **Backend:** Serverless infrastructure powered by **Supabase (PostgreSQL)**.
* **Edge Logic:** Leveraging **PostgreSQL RPC** (Remote Procedure Call) to handle "seen-id" filtering directly at the database level, reducing JSON payload by 70%.
* **Security:** Bulletproof privacy via **Row Level Security (RLS)**; no personal identifiable information (PII) is ever stored.

---

## 🛠️ Technical Decisions

| Feature | Solution | Rationale |
| :--- | :--- | :--- |
| **Zero-Latency Feed** | Batch-prefetching | Eliminates "Loading" states; $O(n)$ deduplication ensures a lag-free experience even after 1,000+ swipes. |
| **Stateless Privacy** | LocalStorage-based ID | Decouples identity from the database to guarantee true anonymity. |
| **AI Content Pipeline** | Gemini + Claude Workflow | Produces 50-100 high-quality, consistent posts per week, saving 80% of manual labor. |

---

## 📈 Results & Lessons (The Pivot)

* **MVP Cost:** ~$50 (Domain & Initial Marketing). Fixed operational cost: **$0/month**.
* **Metrics:** 33 organic views during the launch week.
* **Lesson Learned:** "Just start doing it." Echoo is the result of four previous failed prototypes, each providing a vital stepping stone.

---

## 🔍 Challenges & Growth Roadmap

* **The "Cold Start" Problem:** Low initial traffic due to the psychological barrier of anonymity and a need for more content seeding.
* **Next Steps:**
    * Scale the **AI-Assisted Content Pipeline** to maintain a "fresh" feed of 100+ posts/week.
    * Deploy **A/B Testing** on paid traffic to identify user emotional "touchpoints."
    * SEO optimization for keywords like "anonymous vent," "secret sharing," and "emotional relief."

---

## 💻 Local Setup

1. `git clone https://github.com/nomnom58/untold.git`
2. `npm install`
3. Create `.env.local` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. `npm run dev`