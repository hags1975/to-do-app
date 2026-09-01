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
    //Testing comment editor
  });
  return stripePromise;
}

document.querySelectorAll(".plan").forEach((planEl) => {
  const button = planEl.querySelector(".select-btn");
  const status = planEl.querySelector(".plan-status");
  const planName = planEl.dataset.plan;

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Loading Stripe...";

    try {
      await loadStripeJs();
      const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
      status.textContent = `Stripe loaded — ready to check out with the ${planName} plan.`;
    } catch (err) {
      status.textContent = "Failed to load Stripe.";
    } finally {
      button.disabled = false;
    }
  });
});
