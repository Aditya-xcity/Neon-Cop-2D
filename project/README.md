# Neon Cop 2D

A fast-paced, browser-based arcade shooter powered by a lightweight Flask backend.

You have **60 seconds** to:

* Shoot enemy targets 🎯
* Avoid civilians 🚫
* Manage ammo 🔫
* Build insane score combos ⚡

---

## ⚙️ Tech Stack

| Layer       | Technology                         |
| ----------- | ---------------------------------- |
| Backend     | Flask (`app.py`)                   |
| Frontend    | HTML, CSS, Vanilla JavaScript      |
| Rendering   | HTML5 Canvas (`static/js/game.js`) |
| Persistence | `localStorage` + in-memory storage |

---

## 📁 Project Structure

```text
project/
  app.py
  static/
    assets/
      images/
      sounds/
    css/
      style.css
    js/
      game.js
  templates/
    index.html
```

---

## 🧠 How It Works

### 1. Backend — Flask (`app.py`)

* `GET /`

  * Serves the main game page (`index.html`)

* `POST /score`

  * Accepts JSON payload:

    ```json
    { "score": 120 }
    ```
  * If valid:

    * Appends score to `score_log`
    * Returns success response
  * If invalid:

    * Returns HTTP 400 error

⚠️ **Important:**

* `score_log` is stored in memory only
* Restarting the server = all scores wiped

---

### 2. Frontend Shell (`templates/index.html`)

Includes:

* 🎮 HUD (Score, High Score, Timer, Ammo, Combo)
* 🖥️ Canvas (`960x540`) for rendering gameplay
* 🔁 Overlay (start/restart screen)
* 🧾 Footer (controls hint)

Linked assets:

* `static/css/style.css`
* `static/js/game.js`

---

### 3. Game Engine (`static/js/game.js`)

Handles core gameplay:

* Dynamic target spawning (enemy ratio increases over time)
* Click detection + hit validation
* Score + combo system
* Ammo management + reload logic
* Rendering:

  * Background
  * Targets
  * Particles
  * Crosshair
* Game ends after 60 seconds

#### 🎯 Gameplay Rules

* Enemy hit → **+10 points** (combo multiplier applies)
* Civilian hit → **−20 points + combo reset**
* Time limit → **60 seconds**
* Ammo → **6 bullets**
* Reload:

  * Auto (when empty)
  * Manual (`R` key)

#### 🔊 Effects & Feedback

* Web Audio API (procedural sound effects)
* Muzzle flashes + particle bursts on hit

#### 💾 Data Handling

* High score → `localStorage`

  * Key: `neonCopHighScore`
* Score submission → `/score`

  * Non-blocking (failures ignored)

---

### 4. Styling (`static/css/style.css`)

* Neon arcade aesthetic 🌈
* Responsive layout (desktop + mobile)
* Glow effects, overlays, scanlines

---

## 🎮 Controls

| Action | Input            |
| ------ | ---------------- |
| Shoot  | Left Mouse Click |
| Reload | `R` key          |

---

## 🚀 Run Locally

### Requirements

* Python **3.9+**
* `pip`

### Install Dependencies

```bash
pip install flask
```

### Start Server

```bash
python app.py
```

Game runs at:

👉 [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 📡 API Reference

### `POST /score`

#### Request

```json
{ "score": 120 }
```

#### Success Response

```json
{ "status": "ok", "latest": 120, "entries": 3 }
```

#### Error Response (400)

```json
{ "status": "error", "message": "score must be an integer" }
```

---

## 🛠️ Troubleshooting

* ❌ `ModuleNotFoundError: No module named 'flask'`
  → Run: `pip install flask`

* 🔇 No sound?
  → Click on the page first (browser audio policy)

* 📉 Scores disappearing?
  → Expected behavior (RAM-based storage resets on restart)

---

## 🚧 Future Improvements

* 💽 Persist scores using SQLite
* 🎮 Add keyboard/touch controls
* 📈 Difficulty levels & progression
* ⚙️ Config-driven constants
* 🧪 Unit tests for Flask + game logic

---

## ✨ Final Note

Simple stack, clean logic, addictive gameplay.

If you're extending this — focus on **performance, feedback feel, and difficulty tuning**. That’s where arcade games really come alive.
