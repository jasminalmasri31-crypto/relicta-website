const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const COUNTER_FILE = path.join(__dirname, "counter.json");

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function readCounter() {
  try {
    if (!fs.existsSync(COUNTER_FILE)) {
      fs.writeFileSync(COUNTER_FILE, JSON.stringify({ total: 0 }, null, 2));
      return 0;
    }

    const raw = fs.readFileSync(COUNTER_FILE, "utf8");
    const data = JSON.parse(raw);

    if (typeof data.total !== "number") {
      return 0;
    }

    return data.total;
  } catch (error) {
    console.error("Fehler beim Lesen von counter.json:", error);
    return 0;
  }
}

function writeCounter(total) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ total }, null, 2));
  } catch (error) {
    console.error("Fehler beim Schreiben von counter.json:", error);
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/visit", (req, res) => {
  try {
    const currentTotal = readCounter();
    const newTotal = currentTotal + 1;
    writeCounter(newTotal);

    res.json({
      ok: true,
      counted: true,
      total: newTotal
    });
  } catch (error) {
    console.error("Fehler bei /api/visit:", error);
    res.status(500).json({ error: "counter_error" });
  }
});

app.get("/api/count", (req, res) => {
  try {
    const total = readCounter();
    res.json({ total });
  } catch (error) {
    console.error("Fehler bei /api/count:", error);
    res.status(500).json({ error: "count_error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});