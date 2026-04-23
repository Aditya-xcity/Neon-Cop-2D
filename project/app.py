from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# In-memory score history for optional tracking/debugging.
score_log = []


@app.route("/")
def menu():
    return render_template("index.html")


@app.route("/game")
def index():
    return render_template("game.html")


@app.post("/score")
def score():
    payload = request.get_json(silent=True) or {}
    value = payload.get("score")

    if isinstance(value, int):
        score_log.append(value)
        return jsonify({"status": "ok", "latest": value, "entries": len(score_log)})

    return jsonify({"status": "error", "message": "score must be an integer"}), 400


if __name__ == "__main__":
    app.run(debug=True)
