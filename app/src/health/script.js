// Update this for the deployed API when it's no longer served from
// localhost:8787 (see api/README.md); keep it in sync with connect-src
// in csp.txt.
const API_BASE_URL = "http://localhost:8787";

const button = document.getElementById("check-health-btn");
const status = document.getElementById("status");
const result = document.getElementById("result");
const resultLabel = document.getElementById("result-label");
const resultBody = document.getElementById("result-body");

button.addEventListener("click", async () => {
  button.disabled = true;
  result.hidden = true;
  status.textContent = "Checking...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();

    resultLabel.textContent = response.ok ? "Healthy" : `Error (${response.status})`;
    resultLabel.classList.toggle("ok", response.ok);
    resultLabel.classList.toggle("error", !response.ok);
    resultBody.textContent = JSON.stringify(data, null, 2);

    result.hidden = false;
    status.textContent = "";
  } catch (err) {
    status.textContent = "Failed to reach the API. Please try again.";
  } finally {
    button.disabled = false;
  }
});
