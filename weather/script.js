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

const cityInput = document.getElementById("city-input");
const button = document.getElementById("get-weather-btn");
const status = document.getElementById("status");
const result = document.getElementById("result");
const resultCity = document.getElementById("result-city");
const resultTemp = document.getElementById("result-temp");
const resultDescription = document.getElementById("result-description");
const resultWind = document.getElementById("result-wind");

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

  const forecastUrl = `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true`;
  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    throw new Error("Forecast request failed");
  }
  const forecastData = await forecastResponse.json();
  const current = forecastData.current_weather;
  if (!current) {
    throw new Error("No current weather available");
  }

  return {
    name: place.name,
    country: place.country,
    temperature: current.temperature,
    windspeed: current.windspeed,
    weathercode: current.weathercode,
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
