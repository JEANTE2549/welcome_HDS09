const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');

// Load environment variables / set defaults
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'jeannarukjungboey1234' || 'HelloHDSgen9';

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// DATABASE INITIALIZATION (Self-Healing SQLite)
// ----------------------------------------------------
const dbPath = path.join(__dirname, 'database.db');
const dbExists = fs.existsSync(dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Categories Table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT 'help-circle',
      color_scheme TEXT DEFAULT 'hsl(20, 90%, 60%)',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. FAQs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      priority_score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `);

  // 3. Incoming Questions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS incoming_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_text TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'converted', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Message Wall Table
  db.run(`
    CREATE TABLE IF NOT EXISTS message_wall (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT DEFAULT 'Anonymous',
      message TEXT NOT NULL,
      color_palette TEXT NOT NULL,
      sticker TEXT DEFAULT '🎉',
      is_approved INTEGER DEFAULT 0, -- 0 = Pending, 1 = Approved
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default dynamic categories and helpful orientation FAQs if table is empty
  db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
    if (err) return console.error("Error checking categories database status:", err);

    if (row && row.count === 0) {
      console.log("Database initialized. Seeding warm orientation content in Thai...");

      const categoriesSeed = [
        { name: "เอกสารสำคัญ 🎒", icon: "file-text", color: "hsl(14, 95%, 70%)" },
        { name: "เครื่องแต่งกาย 👕", icon: "shirt", color: "hsl(165, 80%, 45%)" },
        { name: "การลงทะเบียน 📝", icon: "clipboard", color: "hsl(330, 85%, 65%)" },
        { name: "วิชาเรียน & ตาราง 📚", icon: "book-open", color: "hsl(210, 90%, 60%)" },
        { name: "ชีวิตในมหาลัย 🏫", icon: "map-pin", color: "hsl(45, 95%, 55%)" }
      ];

      const stmt = db.prepare("INSERT INTO categories (name, icon, color_scheme) VALUES (?, ?, ?)");
      categoriesSeed.forEach(cat => {
        stmt.run(cat.name, cat.icon, cat.color);
      });
      stmt.finalize();

      // Seed core orientation FAQs linked to these categories
      const faqsSeed = [
        {
          catId: 1, // เอกสารสำคัญ
          q: "ในวันรายงานตัว/ลงทะเบียน ต้องเตรียมเอกสารอะไรไปบ้าง?",
          a: "เอกสารที่ต้องนำมาด้วย ได้แก่ ใบแสดงผลการเรียน (Transcript) ตัวจริง, ใบรับรองการตอบรับเข้าเรียน, สำเนาบัตรประชาชน 2 ชุด และรูปถ่ายหน้าตรงขนาด 1 นิ้ว จำนวน 4 ใบ (พื้นหลังสีฟ้าล้วน) ไม่ต้องกังวลนะครับ วันรายงานตัวจะมีพี่ ๆ สแตนบายรอช่วยตรวจเช็คและพาเดินไปตามจุดต่าง ๆ ตลอดทางเลย!",
          priority: 10
        },
        {
          catId: 2, // เครื่องแต่งกาย
          q: "รองเท้าผ้าใบสีขาวจำเป็นต้องใส่ในวันแรกไหม หรือใส่สีอื่นได้?",
          a: "ตามกฎระเบียบของมหาวิทยาลัย สำหรับกิจกรรมที่เป็นพิธีการหรือวันปฐมนิเทศรวม แนะนำให้ใส่รองเท้าผ้าใบสีขาวล้วนที่สะอาดเรียบร้อยครับ แต่สำหรับวันเรียนปกติหรือกิจกรรมสันทนาการ น้อง ๆ สามารถสวมใส่รองเท้าผ้าใบหรือรองเท้าหุ้มส้นสีสุภาพทั่วไปได้เลย แนะนำให้เลือกรองเท้าที่ใส่สบายที่สุดเพราะวันแรก ๆ เดินเยอะมากครับ!",
          priority: 9
        },
        {
          catId: 3, // การลงทะเบียน
          q: "หากเข้ารอบลงทะเบียนวิชาเรียนช่วงเช้าไม่ทัน ต้องทำอย่างไร?",
          a: "ไม่ต้องตกใจไปครับ! ระบบลงทะเบียนออนไลน์จะเปิดให้ลงทะเบียนรอบล่าช้าอยู่ หลังจากกดลงทะเบียนในเว็บเสร็จเรียบร้อยแล้ว น้อง ๆ สามารถเข้ามารับคู่มือนักศึกษาและบัตรประจำตัวได้ที่ห้องทะเบียนกลาง ณ อาคารเรียน A ชั้น 2 ในสัปดาห์แรกของการเปิดเรียนได้ตามปกติครับ",
          priority: 8
        },
        {
          catId: 4, // วิชาเรียน & ตาราง
          q: "การเพิ่มหรือลดรายวิชาเรียน (Add/Drop) มีขั้นตอนอย่างไรบ้าง?",
          a: "น้อง ๆ สามารถดำเนินการขอเพิ่ม-ลดวิชาเรียนได้เองในระบบ RegPortal ของมหาวิทยาลัยในช่วง 2 สัปดาห์แรกของภาคเรียนครับ โดยวิชาเลือกหรือวิชาเสรีบางตัวจะต้องมีลายเซ็นดิจิทัลอนุมัติจากอาจารย์ที่ปรึกษาก่อน พี่ ๆ แนะนำให้รีบไปยื่นเรื่องตั้งแต่วันแรก ๆ เพื่อป้องกันวิชาเรียนยอดฮิตเต็มนะครับ!",
          priority: 7
        },
        {
          catId: 5, // ชีวิตในมหาลัย
          q: "โรงอาหารไหนอร่อย คุ้มค่า และเดินทางไปง่ายที่สุด?",
          a: "แนะนำ 'ศูนย์อาหาร Student Center Plaza' ใต้ตึกกิจกรรมนักศึกษาเลยครับ! มีร้านสตรีทฟู้ดอร่อย ๆ หลากหลายมาก ราคาเป็นมิตรกับนักศึกษา และมีพื้นที่นั่งเล่นในสวนหย่อมรับลมธรรมชาติที่ชมรมต่าง ๆ ชอบมานั่งทำกิจกรรมกัน เมนูเด็ดที่ห้ามพลาดคือบะหมี่ไก่ตุ๋นร้านที่ 4 ครับ!",
          priority: 6
        }
      ];

      const faqStmt = db.prepare("INSERT INTO faqs (category_id, question, answer, priority_score) VALUES (?, ?, ?, ?)");
      faqsSeed.forEach(faq => {
        faqStmt.run(faq.catId, faq.q, faq.a, faq.priority);
      });
      faqStmt.finalize();

      // (No pre-seeded message wall items - database starts completely clean!)

      console.log("Database seeded successfully in Thai.");
    }
  });
});

// ----------------------------------------------------
// SPAM LIMITER & PROFANITY GUARD UTILITIES
// ----------------------------------------------------
const ipRequestLog = {};
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 Hour window
const MAX_POSTS_PER_WINDOW = 5; // Allow 5 submissions per IP per hour

function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (!ipRequestLog[ip]) {
    ipRequestLog[ip] = [];
  }

  // Filter out expired timestamps
  ipRequestLog[ip] = ipRequestLog[ip].filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

  if (ipRequestLog[ip].length >= MAX_POSTS_PER_WINDOW) {
    return res.status(429).json({
      error: "You're sharing so much excitement! Let's take a quick breather. (Limit: 5 submissions per hour)"
    });
  }

  ipRequestLog[ip].push(now);
  next();
}

// HTML tag escaping for XSS protection while leaving content moderation purely manual for seniors
function cleanContent(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ----------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// ----------------------------------------------------
function adminOnly(req, res, next) {
  const passkey = req.cookies.admin_token || req.headers['authorization'] || req.query.key;

  if (passkey === ADMIN_SECRET) {
    next();
  } else {
    res.status(401).json({ error: "Access denied. Please enter the correct admin secret key." });
  }
}

// ----------------------------------------------------
// PUBLIC API ROUTES
// ----------------------------------------------------

// 1. Fetch all active categories
app.get('/api/categories', (req, res) => {
  db.all("SELECT * FROM categories ORDER BY name ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. Fetch all FAQs (Join with Category)
app.get('/api/faqs', (req, res) => {
  db.all(`
    SELECT faqs.*, categories.name as category_name, categories.color_scheme
    FROM faqs 
    JOIN categories ON faqs.category_id = categories.id
    ORDER BY faqs.priority_score DESC, faqs.id DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Submit anonymous question (Ask Seniors Gateway)
app.post('/api/questions', rateLimiter, (req, res) => {
  const { question } = req.body;
  if (!question || question.trim().length < 5) {
    return res.status(400).json({ error: "Question must be at least 5 characters long." });
  }

  const sanitized = cleanContent(question);
  db.run("INSERT INTO incoming_questions (question_text, status) VALUES (?, 'pending')", [sanitized], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

// 4. Submit message to wall
app.post('/api/messages', rateLimiter, (req, res) => {
  const { nickname, message, color_palette, sticker } = req.body;
  if (!message || message.trim().length < 2) {
    return res.status(400).json({ error: "Message must contain content." });
  }
  if (message.length > 120) {
    return res.status(400).json({ error: "Keep it sweet! (120 characters max)" });
  }

  const cleanMsg = cleanContent(message);
  const cleanNickname = nickname ? cleanContent(nickname).slice(0, 30) : "Anonymous";
  const defaultColors = "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)";

  db.run(
    "INSERT INTO message_wall (nickname, message, color_palette, sticker, is_approved) VALUES (?, ?, ?, ?, 0)",
    [cleanNickname, cleanMsg, color_palette || defaultColors, sticker || "🎉"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// 5. Fetch all approved messages for the wall
app.get('/api/messages/approved', (req, res) => {
  db.all("SELECT * FROM message_wall WHERE is_approved = 1 ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ----------------------------------------------------
// ADMIN PROTECTED API ROUTES
// ----------------------------------------------------

// Verify Passkey & set cookie
app.post('/api/admin/verify', (req, res) => {
  const { key } = req.body;
  if (key === ADMIN_SECRET) {
    // Set cookie for 7 days
    res.cookie('admin_token', ADMIN_SECRET, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: false, // Accessible by frontend JS easily
      path: '/'
    });
    res.json({ success: true, message: "Welcome to the family workspace, Senior!" });
  } else {
    res.status(401).json({ error: "Oops! That's not the right passcode." });
  }
});

// Admin status check helper
app.get('/api/admin/status', (req, res) => {
  const token = req.cookies.admin_token;
  if (token === ADMIN_SECRET) {
    res.json({ authorized: true });
  } else {
    res.json({ authorized: false });
  }
});

// Fetch pending questions
app.get('/api/admin/questions', adminOnly, (req, res) => {
  db.all("SELECT * FROM incoming_questions WHERE status = 'pending' ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Dismiss / delete incoming question
app.delete('/api/admin/questions/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM incoming_questions WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Create Category
app.post('/api/admin/categories', adminOnly, (req, res) => {
  const { name, icon, color_scheme } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required" });

  db.run(
    "INSERT INTO categories (name, icon, color_scheme) VALUES (?, ?, ?)",
    [name, icon || 'help-circle', color_scheme || 'hsl(20, 90%, 60%)'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Edit Category
app.put('/api/admin/categories/:id', adminOnly, (req, res) => {
  const { name, icon, color_scheme } = req.body;
  db.run(
    "UPDATE categories SET name = ?, icon = ?, color_scheme = ? WHERE id = ?",
    [name, icon, color_scheme, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Delete Category
app.delete('/api/admin/categories/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM categories WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Create / Edit FAQ entries
app.post('/api/admin/faqs', adminOnly, (req, res) => {
  const { category_id, question, answer, priority_score, convert_question_id } = req.body;
  if (!category_id || !question || !answer) {
    return res.status(400).json({ error: "Missing required fields for FAQ." });
  }

  db.serialize(() => {
    // Insert new FAQ
    db.run(
      "INSERT INTO faqs (category_id, question, answer, priority_score) VALUES (?, ?, ?, ?)",
      [category_id, question, answer, priority_score || 0],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const newFaqId = this.lastID;

        // If converted from an incoming question, archive it
        if (convert_question_id) {
          db.run(
            "UPDATE incoming_questions SET status = 'converted' WHERE id = ?",
            [convert_question_id],
            (err) => {
              if (err) console.error("Failed to update status of converted question:", err);
            }
          );
        }

        res.json({ success: true, id: newFaqId });
      }
    );
  });
});

app.put('/api/admin/faqs/:id', adminOnly, (req, res) => {
  const { category_id, question, answer, priority_score } = req.body;
  db.run(
    "UPDATE faqs SET category_id = ?, question = ?, answer = ?, priority_score = ? WHERE id = ?",
    [category_id, question, answer, priority_score || 0, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/admin/faqs/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM faqs WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Fetch pending message wall queue
app.get('/api/admin/messages/pending', adminOnly, (req, res) => {
  db.all("SELECT * FROM message_wall WHERE is_approved = 0 ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Approve a message
app.put('/api/admin/messages/:id/approve', adminOnly, (req, res) => {
  db.run("UPDATE message_wall SET is_approved = 1 WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Reject / delete message from the wall
app.delete('/api/admin/messages/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM message_wall WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Explicit admin route to serve the dedicated administrative page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback routing: send index.html for SPA page routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Launch server
app.listen(PORT, () => {
  console.log(`🎉 Orientation server running with joy on: http://localhost:${PORT}`);
});
