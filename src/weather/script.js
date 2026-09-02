(() => {
  const button = document.getElementById("get-weather-btn");
  const status = document.getElementById("status");
  let scriptRequested = false;

  button.addEventListener("click", () => {
    if (scriptRequested) {
      return;
    }
    scriptRequested = true;

    button.disabled = true;
    status.textContent = "Loading weather app...";

    const script = document.createElement("script");
    script.src = "/weather/_lazy-weather.js";
    script.onload = () => {
      button.disabled = false;
      button.click();
    };
    script.onerror = () => {
      scriptRequested = false;
      status.textContent = "Failed to load weather. Please try again.";
      button.disabled = false;
    };
    document.head.appendChild(script);
  });
})();
