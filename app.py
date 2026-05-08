from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

countries = {
    "Germany": {
        "capital": "Berlin",
        "image": "/static/countries/germany.jpg"
    },
    "France": {
        "capital": "Paris",
        "image": "/static/countries/france.jpg"
    },
    "Spain": {
        "capital": "Madrid",
        "image": "/static/countries/spain.jpg"
    },
    "Italy": {
        "capital": "Rome",
        "image": "/static/countries/italy.jpg"
    },
    "Poland": {
        "capital": "Warsaw",
        "image": "/static/countries/poland.jpg"
    },
    "United Kingdom": {
        "capital": "London",
        "image": "/static/countries/united_kingdom.jpg"
    }
}

@app.route("/")
def index():
    return render_template("index.html", countries=countries)

@app.route("/get_country", methods=["POST"])
def get_country():
    data = request.get_json()

    # fallback if still using old system
    if "country" in data:
        name = data["country"]
        return jsonify(countries.get(name, {
            "capital": "Unknown",
            "image": "/static/static.webp"
        }))

    # NEW: lat/lng mode (simplified)
    lat = data.get("lat")
    lng = data.get("lng")

    # placeholder logic (you can improve later with real geo lookup)
    return jsonify({
        "capital": f"Lat {lat:.2f}, Lng {lng:.2f}",
        "image": "/static/static.webp"
    })

if __name__ == "__main__":
    app.run(debug=True)