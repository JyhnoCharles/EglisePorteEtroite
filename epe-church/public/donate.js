
const stripe = Stripe("pk_test_51U31p8IN2hGgTHPSMq7SQKTRfBYlrAvpQ27NQni74Au5jq9OECHH8CSUPZKSClxWj1RGMbimMWGO3zAvLyHspQa600r4gwyvgA");

let selectedAmount = 50;

const amountButtons = document.querySelectorAll(".amount-btn");
const customAmountInput = document.getElementById("customAmount");

amountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedAmount = Number(button.dataset.amount);
    customAmountInput.value = "";

    amountButtons.forEach((b) => b.classList.remove("is-selected"));
    button.classList.add("is-selected");
  });
});

customAmountInput.addEventListener("input", (e) => {
  if (e.target.value) {
    selectedAmount = Number(e.target.value);
    amountButtons.forEach((b) => b.classList.remove("is-selected"));
  }
});

document.getElementById("donateBtn").addEventListener("click", async () => {
  const btn = document.getElementById("donateBtn");
  const recurring = document.getElementById("recurringCheck").checked;
  const fund = document.getElementById("fundSelect").value;

  btn.disabled = true;
  btn.querySelector(".give-btn-label").textContent = "Loading…";

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: selectedAmount, recurring, fund }),
    });

    const data = await res.json();

    if (data.clientSecret) {
      const checkout = await stripe.initEmbeddedCheckout({
        clientSecret: data.clientSecret,
      });

      document.getElementById("give-form").style.display = "none";
      checkout.mount("#checkout");
    } else {
      throw new Error("No client secret returned");
    }
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.querySelector(".give-btn-label").textContent = "Continue to give";
    alert("Something went wrong. Please try again.");
  }
});