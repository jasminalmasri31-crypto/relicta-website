const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function getVisitorHash(req, day) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress || "";
  const userAgent = req.headers["user-agent"] || "";
  const salt = process.env.VISITOR_SALT || "change-me";

  return crypto
    .createHash("sha256")
    .update(`${salt}:${day}:${ip}:${userAgent}`)
    .digest("hex");
}

app.post("/api/visit", async (req, res) => {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const page = (req.body.page || "home").slice(0, 100);
    const visitorHash = getVisitorHash(req, day);
    const createdAt = new Date().toISOString();

    const insertResult = await pool.query(
      `INSERT INTO visits (day, visitor_hash, page, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (day, visitor_hash, page) DO NOTHING`,
      [day, visitorHash, page, createdAt]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM visits`
    );

    res.json({
      ok: true,
      counted: insertResult.rowCount > 0,
      total: countResult.rows[0].total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.get("/api/count", async (req, res) => {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM visits`);
    res.json({ total: result.rows[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "count_error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
