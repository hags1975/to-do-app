const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const WEATHER_DESCRIPTIONS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeatherCode(code) {
  return WEATHER_DESCRIPTIONS[code] || "Unknown conditions";
}

const CLOTHING_OFFSETS = {
  light: 0,
  medium: 6,
  heavy: 12,
};

function assessComfort(apparentTemperature, clothingLevel) {
  const effectiveTemp = apparentTemperature + CLOTHING_OFFSETS[clothingLevel];

  if (effectiveTemp < 5) {
    return { label: "Too cold", message: "You'll likely feel cold — consider heavier clothing." };
  }
  if (effectiveTemp < 15) {
    return { label: "Cool", message: "A bit cool for this outfit — an extra layer would help." };
  }
  if (effectiveTemp < 25) {
    return { label: "Comfortable", message: "This clothing should feel comfortable in these conditions." };
  }
  if (effectiveTemp < 30) {
    return { label: "Warm", message: "You'll likely feel warm — lighter clothing may be more comfortable." };
  }
  return { label: "Too hot", message: "You'll likely feel too hot — consider lighter clothing." };
}

const cityInput = document.getElementById("city-input");
const button = document.getElementById("get-weather-btn");
const status = document.getElementById("status");
const result = document.getElementById("result");
const resultCity = document.getElementById("result-city");
const resultTemp = document.getElementById("result-temp");
const resultDescription = document.getElementById("result-description");
const resultWind = document.getElementById("result-wind");
const resultHumidity = document.getElementById("result-humidity");
const resultComfort = document.getElementById("result-comfort");
const clothingButtons = document.querySelectorAll(".clothing-btn");

let clothingLevel = "medium";
let lastWeather = null;

function renderComfort() {
  if (!lastWeather) {
    return;
  }
  const comfort = assessComfort(lastWeather.apparentTemperature, clothingLevel);
  resultComfort.textContent = `${comfort.label}: ${comfort.message}`;
}

clothingButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    clothingLevel = btn.dataset.level;
    clothingButtons.forEach((b) => b.classList.toggle("active", b === btn));
    renderComfort();
  });
});

async function fetchWeather(city) {
  const geocodeUrl = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1`;
  const geocodeResponse = await fetch(geocodeUrl);
  if (!geocodeResponse.ok) {
    throw new Error("Geocoding request failed");
  }
  const geocodeData = await geocodeResponse.json();
  const place = geocodeData.results && geocodeData.results[0];
  if (!place) {
    throw new Error("City not found");
  }

  const currentParams = "temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m,apparent_temperature";
  const forecastUrl = `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}&current=${currentParams}`;
  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    throw new Error("Forecast request failed");
  }
  const forecastData = await forecastResponse.json();
  const current = forecastData.current;
  if (!current) {
    throw new Error("No current weather available");
  }

  return {
    name: place.name,
    country: place.country,
    temperature: current.temperature_2m,
    windspeed: current.wind_speed_10m,
    weathercode: current.weather_code,
    humidity: current.relative_humidity_2m,
    apparentTemperature: current.apparent_temperature,
  };
}

button.addEventListener("click", async () => {
  const city = cityInput.value.trim();
  if (!city) {
    status.textContent = "Please enter a city name.";
    result.hidden = true;
    return;
  }

  button.disabled = true;
  result.hidden = true;
  status.textContent = "Loading weather...";

  try {
    const weather = await fetchWeather(city);
    resultCity.textContent = weather.country ? `${weather.name}, ${weather.country}` : weather.name;
    resultTemp.textContent = `${Math.round(weather.temperature)}°C`;
    resultDescription.textContent = describeWeatherCode(weather.weathercode);
    resultWind.textContent = `Wind: ${weather.windspeed} km/h`;
    resultHumidity.textContent = `Humidity: ${Math.round(weather.humidity)}%`;
    lastWeather = weather;
    renderComfort();
    result.hidden = false;
    status.textContent = "";
  } catch (err) {
    status.textContent = err.message === "City not found"
      ? "Couldn't find that city. Try a different name."
      : "Failed to load weather. Please try again.";
  } finally {
    button.disabled = false;
  }
});

cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    button.click();
  }
});
