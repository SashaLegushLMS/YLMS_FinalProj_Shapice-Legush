from flask import Flask, request, jsonify, render_template
import requests
import sqlite3
from urllib.parse import quote

app = Flask(__name__)

OPENCAGE_API_KEY = "b3e000baa86547b986357b08160f2589"

# ---------------- DATABASE ----------------

conn = sqlite3.connect("countries.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS countries (
    name TEXT PRIMARY KEY,
    capital TEXT,
    image TEXT
)
""")

conn.commit()

# ---------------- GET CAPITAL IMAGE ----------------

def get_capital_image(capital):

    try:

        url = (
            "https://en.wikipedia.org/api/rest_v1/page/summary/"
            + quote(capital)
        )

        headers = {
            "User-Agent": "WorldMapViewer/1.0"
        }

        response = requests.get(url, headers=headers)

        print("STATUS:", response.status_code)
        print("TEXT:", response.text[:200])

        # wikipedia sometimes returns non-json
        if not response.text.strip():
            return "/static/static.webp"

        data = response.json()

        print("WIKIPEDIA:", data)

        thumbnail = data.get("thumbnail")

        if thumbnail:

            image_url = thumbnail.get("source")

            if image_url:

                if image_url.startswith("//"):
                    image_url = "https:" + image_url

                return image_url

    except Exception as e:

        print("IMAGE ERROR:", e)

    return "/static/static.webp"

# ---------------- HOME ----------------

@app.route("/")
def index():

    cursor.execute("SELECT name FROM countries ORDER BY name")

    rows = cursor.fetchall()

    countries = {row[0]: {} for row in rows}

    return render_template("index.html", countries=countries)

# ---------------- COUNTRY LOOKUP ----------------

@app.route("/get_country", methods=["POST"])
def get_country():

    data = request.get_json()

    lat = data.get("lat")
    lng = data.get("lng")

    try:

        # -------- GET COUNTRY NAME --------

        geo_url = "https://api.opencagedata.com/geocode/v1/json"

        geo_params = {
            "q": f"{lat},{lng}",
            "key": OPENCAGE_API_KEY
        }

        geo_response = requests.get(geo_url, params=geo_params)

        geo = geo_response.json()

        print(geo)

        country_name = geo["results"][0]["components"].get("country")

        print("COUNTRY:", country_name)

        # -------- CHECK DATABASE --------

        cursor.execute(
            "SELECT capital, image FROM countries WHERE name=?",
            (country_name,)
        )

        row = cursor.fetchone()

        # -------- RETURN CACHED --------

        if row:

            print("Loaded from database")

            return jsonify({
                "country": country_name,
                "capital": row[0],
                "image": row[1]
            })

        # -------- FETCH FROM RESTCOUNTRIES --------

        print("Fetching from API")

        rest_url = (
            "https://restcountries.com/v3.1/name/"
            + quote(country_name)
        )

        rest_response = requests.get(rest_url)

        rest_data = rest_response.json()

        capital = "Unknown"

        if isinstance(rest_data, list):

            capital = rest_data[0].get(
                "capital",
                ["Unknown"]
            )[0]

        # -------- GET CAPITAL IMAGE --------

        image = get_capital_image(capital)

        # -------- SAVE TO DATABASE --------

        cursor.execute(
            "INSERT INTO countries (name, capital, image) VALUES (?, ?, ?)",
            (country_name, capital, image)
        )

        conn.commit()

        print("Saved to database")

        # -------- RETURN --------

        return jsonify({
            "country": country_name,
            "capital": capital,
            "image": image
        })

    except Exception as e:

        print("ERROR:", e)

        return jsonify({
            "country": "Error",
            "capital": "Error",
            "image": "/static/static.webp"
        })

# ---------------- START ----------------

if __name__ == "__main__":
    app.run(debug=True)