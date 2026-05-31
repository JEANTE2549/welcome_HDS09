const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');

// Load environment variables / set defaults
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'welcomefamily2026';

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
      console.log("Database initialized. Seeding warm orientation content...");

      const categoriesSeed = [
        { name: "Documents 🎒", icon: "file-text", color: "hsl(14, 95%, 70%)" },
        { name: "Uniforms 👕", icon: "shirt", color: "hsl(165, 80%, 45%)" },
        { name: "Registration 📝", icon: "clipboard", color: "hsl(330, 85%, 65%)" },
        { name: "Courses 📚", icon: "book-open", color: "hsl(210, 90%, 60%)" },
        { name: "Campus Life 🏫", icon: "map-pin", color: "hsl(45, 95%, 55%)" }
      ];

      const stmt = db.prepare("INSERT INTO categories (name, icon, color_scheme) VALUES (?, ?, ?)");
      categoriesSeed.forEach(cat => {
        stmt.run(cat.name, cat.icon, cat.color);
      });
      stmt.finalize();

      // Seed core orientation FAQs linked to these categories
      const faqsSeed = [
        {
          catId: 1, // Documents
          q: "What documents must I present on Registration Day?",
          a: "Please bring your original high school transcript, a printed copy of your acceptance letter, 2 copies of your ID card/passport, and 4 passport-sized photos with a light blue background. Don't worry, seniors will be right outside the gate to guide you to the checklist desk!",
          priority: 10
        },
        {
          catId: 2, // Uniforms
          q: "Are white sneakers mandatory, or can I wear colored ones?",
          a: "Standard regulations suggest plain white sneakers for formal events. However, for everyday lectures, comfortable shoes of any color are perfectly fine! Tip: Orientation week involves a lot of walking, so prioritize comfort!",
          priority: 9
        },
        {
          catId: 3, // Registration
          q: "I am late for the registration session. Can I register online?",
          a: "Yes! The online portal remains open for late additions. After registering online, please visit the central registry office on Building A, Floor 2, to collect your student handbook and badge.",
          priority: 8
        },
        {
          catId: 4, // Courses
          q: "How do I add or drop elective courses?",
          a: "You can modify your syllabus choices during the first two weeks of classes using the 'RegPortal' student site. Your faculty advisor must sign off on changes, so we recommend dropping by their office early!",
          priority: 7
        },
        {
          catId: 5, // Campus Life
          q: "Where is the best food court on campus?",
          a: "Definitely the Student Center Food Plaza! It has amazing dynamic street-food stalls, student discount prices, and a vibrant outdoor seating garden where clubs gather. Try the chicken noodles on Stall 4!",
          priority: 6
        }
      ];

      const faqStmt = db.prepare("INSERT INTO faqs (category_id, question, answer, priority_score) VALUES (?, ?, ?, ?)");
      faqsSeed.forEach(faq => {
        faqStmt.run(faq.catId, faq.q, faq.a, faq.priority);
      });
      faqStmt.finalize();

      // Seed initial welcoming message wall items
      const messagesSeed = [
        { name: "Jamie (Senior 🦁)", msg: "Welcome to our big family, freshies! You are going to love it here!", sticker: "🎉", colors: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" },
        { name: "P' Dan 🎓", msg: "If you get lost in Building C, look for the seniors wearing green shirts! We are here to help.", sticker: "🧸", colors: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)" },
        { name: "Anonymous 🎒", msg: "Uniform shoes are white, but my energy is 100% colorful today! Let's go orientation week!", sticker: "🎈", colors: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" }
      ];

      const msgStmt = db.prepare("INSERT INTO message_wall (nickname, message, sticker, color_palette, is_approved) VALUES (?, ?, ?, ?, 1)");
      messagesSeed.forEach(m => {
        msgStmt.run(m.name, m.msg, m.sticker, m.colors);
      });
      msgStmt.finalize();

      console.log("Database seeded successfully.");
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

// Character normalization + profanity guard
const BANNED_WORDS = [
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'bastard', 'whore',
  'ควย', 'เย็ด', 'เหี้ย', 'สัส', 'ชิบหาย', 'มึง', 'กู', 'ตอแหล', 'กระหรี่', 'แรด'
];

function cleanContent(text) {
  if (!text) return "";
  
  // Normalization Map for common bypasses
  const normalizeMap = {
    '@': 'a', '4': 'a', '1': 'i', '!': 'i', '0': 'o', '3': 'e', '5': 's', '$': 's', '7': 't',
    'เย็': 'เย็ด', 'ค.ว.ย': 'ควย'
  };

  let normalized = text.toLowerCase();
  for (const [obfuscated, normal] of Object.entries(normalizeMap)) {
    normalized = normalized.split(obfuscated).join(normal);
  }

  // Remove spacing/special characters to test clustered bypasses
  const stripped = normalized.replace(/[^a-zA-Z0-9ก-๙]/g, "");

  let isFlagged = false;
  BANNED_WORDS.forEach(word => {
    if (normalized.includes(word) || stripped.includes(word)) {
      isFlagged = true;
    }
  });

  if (isFlagged) {
    // Return friendly substitution
    return "🧡 [Spread kindness and friendly vibes!]";
  }

  return text;
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
  db.run("INSERT INTO incoming_questions (question_text, status) VALUES (?, 'pending')", [sanitized], function(err) {
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
    function(err) {
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
  db.run("DELETE FROM incoming_questions WHERE id = ?", [req.params.id], function(err) {
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
    function(err) {
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
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Delete Category
app.delete('/api/admin/categories/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM categories WHERE id = ?", [req.params.id], function(err) {
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
      function(err) {
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
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/admin/faqs/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM faqs WHERE id = ?", [req.params.id], function(err) {
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
  db.run("UPDATE message_wall SET is_approved = 1 WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Reject / delete message from the wall
app.delete('/api/admin/messages/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM message_wall WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Fallback routing: send index.html for SPA page routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Launch server
app.listen(PORT, () => {
  console.log(`🎉 Orientation server running with joy on: http://localhost:${PORT}`);
});
