from flask import Flask, request, jsonify, render_template
import requests
import sqlite3
from urllib.parse import quote

app = Flask(__name__)

OPENCAGE_API_KEY = "b3e000baa86547b986357b08160f2589"
WEATHER_API_KEY = "1a7f51c23fcfefd85eec06b53cca2585"

# ---------------- ДАТАБАЗА ----------------

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

# ---------------- ПОГОДА ----------------

def get_weather(lat, lng):
    url = "https://api.openweathermap.org/data/2.5/weather"

    params = {
        "lat": lat,
        "lon": lng,
        "appid": WEATHER_API_KEY,
        "units": "metric"
    }

    r = requests.get(url, params=params)
    data = r.json()

    weather = data["weather"][0]["main"]
    temp = data["main"]["temp"]

    return {
        "type": weather,
        "temp": temp
    }

# ---------------- КАРТИНКА СТОЛИЦЫ ----------------

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

        data = response.json()

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

# ---------------- ХОМ ----------------

@app.route("/")
def index():
    cursor.execute("SELECT name FROM countries ORDER BY name")
    rows = cursor.fetchall()

    countries = {row[0]: {} for row in rows}

    return render_template("index.html", countries=countries)

# ---------------- ПОИСК СТРАНЫ ----------------

@app.route("/get_country", methods=["POST"])
def get_country():

    data = request.get_json()

    lat = data.get("lat")
    lng = data.get("lng")

    try:

        # -------- ПОИСК ПО ГЕО --------
        geo_url = "https://api.opencagedata.com/geocode/v1/json"

        geo_params = {
            "q": f"{lat},{lng}",
            "key": OPENCAGE_API_KEY

        }

        geo_response = requests.get(geo_url, params=geo_params)
        geo = geo_response.json()

        if not geo.get("results"):
            return jsonify({
                "country": "Unknown",
                "capital": "Unknown",
                "image": "/static/static.webp",
                "weather": {
                    "type": "Unknown",
                    "temp": 0
                }
            })

        components = geo["results"][0].get("components", {})
        country_name = components.get("country", "Unknown")

        # -------- ПРОВЕРКА ДАТАБАЗЫ --------
        cursor.execute(
            "SELECT capital, image FROM countries WHERE name=?",
            (country_name,)
        )

        row = cursor.fetchone()

        # -----------------------------
        # СТРАНЫ КОТОРЫЕ УЖЕ БЫЛИ В БАЗЕ ДАННЫХ
        # -----------------------------
        if row:

            capital = row[0]
            image = row[1]

        else:

            # -------- RESTCOUNTRIES --------
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

            # -------- КАРТИКА --------
            image = get_capital_image(capital)

            # -------- СОХРАНЕНИЕ --------
            cursor.execute(
                "INSERT INTO countries VALUES (?, ?, ?)",
                (country_name, capital, image)
            )

            conn.commit()

        # --------------------------------
        # ПОЛУЧЕНИЕ ПОГОДЫ В СТОЛИЦЕ
        # --------------------------------

        weather = {
            "type": "Unknown",
            "temp": 0
        }

        try:

            capital_geo_params = {
                "q": capital,
                "key": OPENCAGE_API_KEY
            }

            capital_geo_response = requests.get(
                geo_url,
                params=capital_geo_params
            )

            capital_geo = capital_geo_response.json()

            if capital_geo.get("results"):

                geometry = capital_geo["results"][0]["geometry"]

                capital_lat = geometry["lat"]
                capital_lng = geometry["lng"]

                weather = get_weather(
                    capital_lat,
                    capital_lng
                )

        except Exception as e:
            print("CAPITAL WEATHER ERROR:", e)

        # -------- ОТВЕТ --------
        return jsonify({
            "country": country_name,
            "capital": capital,
            "image": image,
            "weather": weather
        })

    except Exception as e:
        print("ERROR:", e)

        return jsonify({
            "country": "Error",
            "capital": "Error",
            "image": "/static/static.webp",
            "weather": {
                "type": "Unknown",
                "temp": 0
            }
        })

# ---------------- СТАРТ ----------------

if __name__ == "__main__":
    app.run(debug=True)