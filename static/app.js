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

let pipActive = false;
let renderLoopId = null;
let currentImgElement = null; // Holds reference to the active country image

// Persistent state tracking arrays for smooth canvas animations (No static flickering)
const rainDrops = [];
const snowFlakes = [];

// Pre-load the cloud asset once when the script initializes
const cloudImg = new Image();
cloudImg.src = "/static/clouds.png";

function initWeatherParticles() {
    rainDrops.length = 0;
    snowFlakes.length = 0;

    // Pre-populate 120 persistent rain lines
    for (let i = 0; i < 120; i++) {
        rainDrops.push({
            x: Math.random() * 1280,
            y: Math.random() * 720,
            speed: 15 + Math.random() * 10,
            len: 12 + Math.random() * 10
        });
    }

    // Pre-populate 80 persistent drifting snowflakes
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
// WEATHER RENDERING (PiP Canvas Engine)
// -------------------------
function drawWeather(ctx) {
    const type = currentWeather.type.toLowerCase();

    // 1. CLEAR SKIES (Radial sun glow overlay)
    if (type.includes("clear")) {
        const gradient = ctx.createRadialGradient(640, 0, 50, 640, 0, 600);
        gradient.addColorStop(0, "rgba(255, 230, 120, 0.25)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. CLOUDS (Tiled/Repeated pattern to prevent stretching - 40% Larger)
    if (type.includes("cloud")) {
        // Soft ambient fog layer tint
        ctx.fillStyle = "rgba(200, 200, 200, 0.08)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render cloud PNG as a repeating pattern if loaded
        if (cloudImg.complete && cloudImg.naturalWidth !== 0) {
            ctx.save(); // Save context state

            // 1. Create the horizontal repeating pattern
            const pattern = ctx.createPattern(cloudImg, 'repeat-x');

            // 2. Calculate scale factor to make the cloud image 210px tall (40% larger than 150px)
            const targetHeight = 210;
            const scaleY = targetHeight / cloudImg.naturalHeight;

            // Keep the aspect ratio uniform by scaling X by the same amount to reduce tiling frequency
            const matrix = new DOMMatrix();
            matrix.scaleSelf(scaleY, scaleY);
            pattern.setTransform(matrix);

            // 3. Apply and fill the top section
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, canvas.width, targetHeight);

            ctx.restore(); // Restore context state
        }
    }

    // 3. RAIN (Animate downward particle lines frame-by-frame)
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

            // Advance particle layout location down the screen canvas
            drop.y += drop.speed;
            if (drop.y > canvas.height) {
                drop.y = -drop.len;
                drop.x = Math.random() * canvas.width;
            }
        });
    }

    // 4. SNOW (Animate drifting round circle layout matrices)
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

    // 5. THUNDERSTORM (Ambient darkness + periodic white flash animations)
    if (type.includes("thunder") || type.includes("storm")) {
        // Darken environment context canvas framework
        ctx.fillStyle = "rgba(15, 15, 35, 0.3)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Procedural Lightning matrix (4% frequency trigger chance per render loop frame update)
        if (Math.random() < 0.04) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Seamlessly bundle background tracking rain strings within the storm pipeline
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
// PiP RENDERING CORE
// -------------------------
function drawPiP(img) {
    // 1. Clear with flat background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!img) return;

    // 2. Scale image (Using Math.min ensures the total image fits without being chopped off)
    const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
    );

    const w = img.width * scale;
    const h = img.height * scale;

    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;

    ctx.drawImage(img, x, y, w, h);

    // 3. Render canvas-driven weather effects directly into the stream frame space
    drawWeather(ctx);

    // 4. Draw Weather Dashboard Box (Bottom Left)
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

    ctx.fillText(`Weather: ${currentWeather.type}`, bx + 15, by + 15);
    ctx.fillText(`${currentWeather.temp}°C`, bx + 15, by + 75);
}

// -------------------------
// ANIMATION LOOP CONTROL
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

// Helper to update HTML view layers alongside the canvas tracking
function updateMainPageWeatherUI(type, temp) {
    // Sync text content
    weatherBox.textContent = `Weather: ${type} | ${temp}°C`;

    // Clear previous weather classes from the normal UI overlays
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
// MAP CLICK LOGIC
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

            // Render country metadata directly to main layout view
            document.getElementById("info").textContent = `${data.country}, ${data.capital}`;

            preview.style.display = "block";
            preview.src = data.image;

            currentWeather = data.weather;

            // Sync main webpage weather presentation layout options
            updateMainPageWeatherUI(currentWeather.type, currentWeather.temp);
            weatherBox.style.display = "block";

            // Prepare Image Asset for Pipeline Capture Engine
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = async () => {
                // Initialize canvas sizes configuration before hooking streams
                canvas.width = 1280;
                canvas.height = 720;

                // Sync global worker pointer targeting new graphic data
                currentImgElement = img;

                // Fire continuous rendering cycles
                startRenderLoop();

                // Re-instantiate stream connection to update rendering targets seamlessly on country updates
                const stream = canvas.captureStream(30);
                video.srcObject = stream;
                await video.play().catch(err => console.warn("Video element autoplay catch:", err));

                // Request Picture-In-Picture presentation layer
                try {
                    pipActive = true;
                    weatherBox.style.display = "none"; // Hide standard box if tracking in PiP window

                    // Small execution pause prevents race-conditions with DOM adjustments
                    setTimeout(async () => {
                        try {
                            // Check if already in PiP window, if not request it
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
// DEBUG WEATHER PANEL
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

// Sync tracking setup so when PiP closes, elements restore back beautifully
video.addEventListener('leavepictureinpicture', () => {
    pipActive = false;
    weatherBox.style.display = "block";
});