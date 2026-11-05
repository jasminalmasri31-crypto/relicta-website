# Relicta – Website

Website für die Gruppe **Relicta Heerlager**, selbst entworfen und umgesetzt.

**Live:** https://relicta.de

## Inhalte
- Startseite mit Bildergalerie („Bilderhalle“)
- Gästebuch / Kontaktformular (über Formspree)
- Verbündete, Tribute, Impressum
- Besucherzähler mit eigener kleiner API

## Technik
- **Frontend:** HTML, CSS, Vanilla JavaScript (responsive)
- **Backend:** Node.js + Express
- **Datenbank:** PostgreSQL (für den Besucherzähler, Besucher werden nur als anonymer Hash gezählt)
- **Hosting:** Render

## Lokal starten
```bash
npm install
npm start
```
Die Seite läuft dann unter http://localhost:3000.

### Umgebungsvariablen
| Variable       | Zweck                                                     |
|----------------|-----------------------------------------------------------|
| `DATABASE_URL` | Verbindung zur PostgreSQL-Datenbank (optional, ohne sie ist der Zähler ausgeblendet) |
| `VISITOR_SALT` | Zufälliger geheimer Text für das anonyme Hashing der Besucher |
| `NODE_ENV`     | Auf Render `production` setzen                            |
