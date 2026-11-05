const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

// Render (und die meisten Hoster) sitzen vor einem Proxy.
// Damit req.secure / req.ip korrekt funktionieren:
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ---------------------------------------------------------------------------
// Datenbank (optional): Ohne DATABASE_URL läuft die Seite trotzdem,
// nur der Besucherzähler ist dann ausgeblendet.
// ---------------------------------------------------------------------------
let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: IS_PROD ? { rejectUnauthorized: false } : false
  });

  // Tabelle automatisch anlegen, falls sie noch nicht existiert
  pool
    .query(
      `CREATE TABLE IF NOT EXISTS visits (
         day          TEXT NOT NULL,
         visitor_hash TEXT NOT NULL,
         page         TEXT NOT NULL,
         created_at   TEXT NOT NULL,
         PRIMARY KEY (day, visitor_hash, page)
       )`
    )
    .catch((err) => console.error("Tabelle konnte nicht angelegt werden:", err.message));
} else {
  console.warn("DATABASE_URL fehlt – Besucherzähler ist deaktiviert.");
}

if (!process.env.VISITOR_SALT) {
  console.warn("VISITOR_SALT ist nicht gesetzt – bitte in den Render-Umgebungsvariablen eintragen.");
}

// ---------------------------------------------------------------------------
// HTTPS erzwingen + Sicherheits-Header
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (IS_PROD && req.headers["x-forwarded-proto"] === "http") {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }

  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "10kb" }));

// ---------------------------------------------------------------------------
// Nur die eigentlichen Website-Dateien ausliefern – nicht den Server-Code,
// package.json usw.
// ---------------------------------------------------------------------------
const PUBLIC_FILE = /^\/[\w.\-]+\.(html|css|js|png|jpe?g|webp|gif|svg|ico)$/i;
const PRIVATE_FILES = new Set(["/server.js"]);

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path === "/" || req.path === "/healthz" || req.path.startsWith("/api/")) return next();

  if (PRIVATE_FILES.has(req.path) || !PUBLIC_FILE.test(req.path)) {
    return res.status(404).send("Nicht gefunden");
  }
  next();
});

app.use(
  express.static(__dirname, {
    index: false,
    dotfiles: "ignore",
    maxAge: IS_PROD ? "7d" : 0
  })
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---------------------------------------------------------------------------
// Besucherzähler
// ---------------------------------------------------------------------------
function getVisitorHash(req, day) {
  const ip = req.ip || "";
  const userAgent = req.headers["user-agent"] || "";
  const salt = process.env.VISITOR_SALT || "change-me";

  return crypto
    .createHash("sha256")
    .update(`${salt}:${day}:${ip}:${userAgent}`)
    .digest("hex");
}

app.post("/api/visit", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "counter_disabled" });

  try {
    const day = new Date().toISOString().slice(0, 10);
    const page = String(req.body.page || "home").slice(0, 100);
    const visitorHash = getVisitorHash(req, day);
    const createdAt = new Date().toISOString();

    const insertResult = await pool.query(
      `INSERT INTO visits (day, visitor_hash, page, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (day, visitor_hash, page) DO NOTHING`,
      [day, visitorHash, page, createdAt]
    );

    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM visits`);

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
  if (!pool) return res.status(503).json({ error: "counter_disabled" });

  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM visits`);
    res.json({ total: result.rows[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "count_error" });
  }
});

// Healthcheck für Render
app.get("/healthz", (req, res) => res.send("ok"));

app.use((req, res) => res.status(404).send("Nicht gefunden"));

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
