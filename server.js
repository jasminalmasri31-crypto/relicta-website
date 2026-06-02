const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", true);
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const COUNTER_FILE = path.join(__dirname, "counter.json");
const VISITORS_FILE = path.join(__dirname, "visitors.json");
const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

function ensureFile(filePath, fallbackData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackData, null, 2), "utf8");
  }
}

function readJson(filePath, fallbackData) {
  try {
    ensureFile(filePath, fallbackData);
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Fehler beim Lesen von ${path.basename(filePath)}:`, error);
    return fallbackData;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Fehler beim Schreiben von ${path.basename(filePath)}:`, error);
  }
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getVisitorId(req, page) {
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  return crypto
    .createHash("sha256")
    .update(`${ip}|${userAgent}|${page}`)
    .digest("hex");
}

function cleanupOldVisitors(visitors) {
  const now = Date.now();
  const cleaned = {};

  for (const [key, timestamp] of Object.entries(visitors)) {
    if (now - Number(timestamp) < WINDOW_MS) {
      cleaned[key] = timestamp;
    }
  }

  return cleaned;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/visit", (req, res) => {
  try {
    const page =
      typeof req.body.page === "string" && req.body.page.trim()
        ? req.body.page.trim().slice(0, 120)
        : "/";

    const counterData = readJson(COUNTER_FILE, { total: 0 });
    let visitorsData = readJson(VISITORS_FILE, {});
    visitorsData = cleanupOldVisitors(visitorsData);

    const visitorId = getVisitorId(req, page);
    const now = Date.now();
    const alreadyCountedAt = visitorsData[visitorId];
    const counted = !alreadyCountedAt || now - Number(alreadyCountedAt) >= WINDOW_MS;

    if (counted) {
      counterData.total = Number(counterData.total || 0) + 1;
      visitorsData[visitorId] = now;
      writeJson(COUNTER_FILE, counterData);
    }

    writeJson(VISITORS_FILE, visitorsData);

    res.json({
      ok: true,
      counted,
      total: Number(counterData.total || 0)
    });
  } catch (error) {
    console.error("Fehler bei /api/visit:", error);
    res.status(500).json({ error: "visit_error" });
  }
});

app.get("/api/count", (req, res) => {
  try {
    const counterData = readJson(COUNTER_FILE, { total: 0 });
    res.json({ total: Number(counterData.total || 0) });
  } catch (error) {
    console.error("Fehler bei /api/count:", error);
    res.status(500).json({ error: "count_error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
