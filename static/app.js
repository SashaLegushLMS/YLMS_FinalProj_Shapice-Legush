const mapImg = document.getElementById("map");
const overlay = document.getElementById("leafletOverlay");

const canvas = document.getElementById("pipCanvas");
const ctx = canvas.getContext("2d");
const video = document.getElementById("pipVideo");
const preview = document.getElementById("preview");

const weatherBox = document.getElementById("weatherBox");
const weatherOverlay = document.getElementById("weatherOverlay");

let currentWeather = {
    type: "Unknown",
    temp: 0
};

let renderLoopId = null;
let currentImgElement = null;

const weatherTranslations = {
    "clear": "Ясно",
    "clouds": "Облачно",
    "rain": "Дождь",
    "snow": "Снег",
    "thunderstorm": "Гроза",
    "unknown": "Неизвестно"
};

// Функция для безопасного перевода
function translateWeather(engType) {
    const lower = (engType || "").toLowerCase();
    for (const key in weatherTranslations) {
        if (lower.includes(key)) {
            return weatherTranslations[key];
        }
    }
    return engType; // Если совпадений нет, вернет текст как есть
}

const rainDrops = [];
const snowFlakes = [];

const cloudImg = new Image();
cloudImg.src = "/static/clouds.png";

function initWeatherParticles() {
    rainDrops.length = 0;
    snowFlakes.length = 0;

    for (let i = 0; i < 120; i++) {
        rainDrops.push({
            x: Math.random() * 1280,
            y: Math.random() * 720,
            speed: 15 + Math.random() * 10,
            len: 12 + Math.random() * 10
        });
    }

    for (let i = 0; i < 80; i++) {
        snowFlakes.push({
            x: Math.random() * 1280,
            y: Math.random() * 720,
            r: 1 + Math.random() * 2.5,
            speedY: 1 + Math.random() * 2,
            speedX: -0.5 + Math.random() * 1
        });
    }
}
initWeatherParticles();

// -------------------------
// РЕНДЕР ПОГОДЫ
// -------------------------
function drawWeather(ctx) {
    const type = currentWeather.type.toLowerCase();

    // 1. Солнечно
    if (type.includes("clear")) {
        const gradient = ctx.createRadialGradient(640, 0, 50, 640, 0, 600);
        gradient.addColorStop(0, "rgba(255, 230, 120, 0.25)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Облачно
    if (type.includes("cloud")) {
        ctx.fillStyle = "rgba(200, 200, 200, 0.08)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (cloudImg.complete && cloudImg.naturalWidth !== 0) {
            ctx.save();

            const pattern = ctx.createPattern(cloudImg, 'repeat-x');
            const targetHeight = 210;
            const scaleY = targetHeight / cloudImg.naturalHeight;

            const matrix = new DOMMatrix();
            matrix.scaleSelf(scaleY, scaleY);
            pattern.setTransform(matrix);

            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, canvas.width, targetHeight);
            ctx.restore();
        }
    }

    // 3. Дождливо
    if (type.includes("rain")) {
        ctx.fillStyle = "rgba(100, 150, 255, 0.08)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "rgba(180, 220, 255, 0.4)";
        ctx.lineWidth = 1.5;

        rainDrops.forEach(drop => {
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + 1, drop.y + drop.len);
            ctx.stroke();

            drop.y += drop.speed;
            if (drop.y > canvas.height) {
                drop.y = -drop.len;
                drop.x = Math.random() * canvas.width;
            }
        });
    }

    // 4. Снег
    if (type.includes("snow")) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "white";
        snowFlakes.forEach(flake => {
            ctx.beginPath();
            ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
            ctx.fill();

            flake.y += flake.speedY;
            flake.x += flake.speedX;

            if (flake.y > canvas.height) {
                flake.y = -flake.r;
                flake.x = Math.random() * canvas.width;
            }
        });
    }

    // 5. Гроза
    if (type.includes("thunder") || type.includes("storm")) {
        ctx.fillStyle = "rgba(15, 15, 35, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (Math.random() < 0.04) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.strokeStyle = "rgba(180, 220, 255, 0.3)";
        ctx.lineWidth = 1.5;
        rainDrops.forEach(drop => {
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + 1, drop.y + drop.len);
            ctx.stroke();

            drop.y += drop.speed;
            if (drop.y > canvas.height) {
                drop.y = -drop.len;
                drop.x = Math.random() * canvas.width;
            }
        });
    }
}

// -------------------------
// ЯДРО РЕНДЕРА ПОГОДЫ
// -------------------------
function drawPiP(img) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!img) return;

    const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
    );

    const w = img.width * scale;
    const h = img.height * scale;

    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;

    ctx.drawImage(img, x, y, w, h);

    drawWeather(ctx);

    const boxW = 670;
    const boxH = 150;

    const bx = 20;
    const by = canvas.height - boxH - 20;

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(bx, by, boxW, boxH);

    ctx.fillStyle = "white";
    ctx.font = "53px Montserrat, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillText(`Погода: ${translateWeather(currentWeather.type)}`, bx + 15, by + 15);
    ctx.fillText(`${currentWeather.temp}°C`, bx + 15, by + 75);
}

// -------------------------
// КОНТРОЛЬ АНИМАЦИИ
// -------------------------
function startRenderLoop() {
    if (renderLoopId) {
        cancelAnimationFrame(renderLoopId);
    }

    function loop() {
        drawPiP(currentImgElement);
        renderLoopId = requestAnimationFrame(loop);
    }

    loop();
}

function updateMainPageWeatherUI(type, temp) {
    weatherBox.textContent = `Weather: ${type} | ${temp}°C`;

    weatherOverlay.className = "";
    weatherOverlay.classList.add("active");

    const lowerType = type.toLowerCase();
    if (lowerType.includes("clear")) weatherOverlay.classList.add("weather-clear");
    else if (lowerType.includes("cloud")) weatherOverlay.classList.add("weather-clouds");
    else if (lowerType.includes("rain")) weatherOverlay.classList.add("weather-rain");
    else if (lowerType.includes("snow")) weatherOverlay.classList.add("weather-snow");
    else if (lowerType.includes("thunder") || lowerType.includes("storm")) weatherOverlay.classList.add("weather-thunderstorm");
}

// -------------------------
// ЛОГИКА ВЗАИМОДЕЙСТВИЯ С КАРТОЙ
// -------------------------
mapImg.addEventListener("click", () => {
    overlay.classList.add("active");

    if (!window.leafletMap) {
        const bounds = [
            [-85, -180],
            [85, 180]
        ];

        window.leafletMap = L.map('leafletOverlay', {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 6,
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            boxZoom: true,
            keyboard: false,
            touchZoom: true,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 6,
            noWrap: true,
            bounds: bounds,
            attribution: '&copy; OpenStreetMap'
        }).addTo(window.leafletMap);

        window.leafletMap.on("click", async (e) => {
            const { lat, lng } = e.latlng;

            const res = await fetch("/get_country", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng })
            });

            const data = await res.json();

            document.getElementById("playerContainer").style.display = "block";

            document.getElementById("info").textContent = `${data.country}, ${data.capital}`;

            preview.style.display = "block";
            preview.src = data.image;

            currentWeather = data.weather;

            document.getElementById("api-disclaimer").style.display = "block";

            updateMainPageWeatherUI(currentWeather.type, currentWeather.temp);
            weatherBox.style.display = "block";

            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = async () => {
                canvas.width = 1280;
                canvas.height = 720;

                currentImgElement = img;

                startRenderLoop();

                const stream = canvas.captureStream(30);
                video.srcObject = stream;
                await video.play().catch(err => console.warn("Video element autoplay catch:", err));

                try {
                    pipActive = true;
                    weatherBox.style.display = "none";

                    setTimeout(async () => {
                        try {
                            if (document.pictureInPictureElement !== video) {
                                await video.requestPictureInPicture();
                            }
                        } catch (pipErr) {
                            console.error("PiP Window Request Denied:", pipErr);
                        }
                    }, 150);

                } catch (err) {
                    console.error("PiP Engine Initialization Fail:", err);
                }
            };

            img.src = data.image;
            overlay.classList.remove("active");
        });
    }

    setTimeout(() => {
        window.leafletMap.invalidateSize();
    }, 100);
});

// -------------------------
// КНОПКА ДЕБАГА ПОГОДЫ
// -------------------------
const debugButton = document.getElementById("debugWeather");

const debugWeathers = [
    "Clear",
    "Clouds",
    "Rain",
    "Snow",
    "Thunderstorm"
];

let debugIndex = 0;

debugButton.addEventListener("click", () => {
    const weatherType = debugWeathers[debugIndex];

    currentWeather = {
        type: weatherType,
        temp: 0
    };

    updateMainPageWeatherUI(weatherType, 0);
    debugIndex = (debugIndex + 1) % debugWeathers.length;
});

video.addEventListener('leavepictureinpicture', () => {
    pipActive = false;
    weatherBox.style.display = "block";
});

// ------------- ПОКАЗ КНОПКИ ДЕБАГА -------------
const projectTitle = document.getElementById("projectTitle");

projectTitle.addEventListener("click", () => {
    if (debugButton.style.display === "none") {
        debugButton.style.display = "block";
    } else {
        debugButton.style.display = "none";
    }
});