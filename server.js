const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const db = new sqlite3.Database("./counter.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      page TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(day, visitor_hash, page)
    )
  `);
});

function getVisitorHash(req, day) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress || "";
  const userAgent = req.headers["user-agent"] || "";
  const salt = "mein-geheimes-salt-123";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${day}:${ip}:${userAgent}`)
    .digest("hex");
}

app.post("/api/visit", (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const page = (req.body.page || "home").slice(0, 100);
  const visitorHash = getVisitorHash(req, day);
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT OR IGNORE INTO visits (day, visitor_hash, page, created_at)
     VALUES (?, ?, ?, ?)`,
    [day, visitorHash, page, createdAt],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "db_error" });
      }

      db.get(`SELECT COUNT(*) AS total FROM visits`, [], (countErr, row) => {
        if (countErr) {
          return res.status(500).json({ error: "count_error" });
        }

        res.json({
          ok: true,
          counted: this.changes > 0,
          total: row.total
        });
      });
    }
  );
});

app.get("/api/count", (req, res) => {
  db.get(`SELECT COUNT(*) AS total FROM visits`, [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "count_error" });
    }
    res.json({ total: row.total });
  });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});