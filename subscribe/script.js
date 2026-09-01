// Placeholder key — no real Stripe account wired up here.
const STRIPE_PUBLISHABLE_KEY = "pk_test_REPLACE_ME";

let stripePromise = null;

function loadStripeJs() {
  if (window.Stripe) {
    return Promise.resolve();
  }
  if (stripePromise) {
    return stripePromise;
  }
  stripePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return stripePromise;
}

const planPicker = document.getElementById("plan-picker");
const confirmation = document.getElementById("confirmation");
const confirmationPlanName = document.getElementById("confirmation-plan-name");
const confirmationPrice = document.getElementById("confirmation-price");
const confirmationStatus = document.getElementById("confirmation-status");
const continueBtn = document.getElementById("continue-btn");
const changePlanBtn = document.getElementById("change-plan-btn");

document.querySelectorAll(".plan").forEach((planEl) => {
  const button = planEl.querySelector(".select-btn");
  const planName = planEl.dataset.plan;
  const price = planEl.dataset.price;

  button.addEventListener("click", () => {
    confirmationPlanName.textContent = planName;
    confirmationPrice.innerHTML = `$${price}<span>/mo</span>`;
    confirmationStatus.textContent = "";
    continueBtn.disabled = false;

    planPicker.hidden = true;
    confirmation.hidden = false;
    window.scrollTo(0, 0);
  });
});

continueBtn.addEventListener("click", async () => {
  continueBtn.disabled = true;
  confirmationStatus.textContent = "Loading Stripe...";

  try {
    await loadStripeJs();
    const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    confirmationStatus.textContent = `Stripe loaded — ready to check out with the ${confirmationPlanName.textContent} plan.`;
  } catch (err) {
    confirmationStatus.textContent = "Failed to load Stripe.";
  } finally {
    continueBtn.disabled = false;
  }
});

changePlanBtn.addEventListener("click", () => {
  confirmation.hidden = true;
  planPicker.hidden = false;
  confirmationStatus.textContent = "";
  window.scrollTo(0, 0);
});
