
const stripe = Stripe("pk_live_51U31p8IN2hGgTHPSL6RQsRqBZEV0ryp46F0Ns1TCJcx5MK8iicbe9p5TIXszeJ5zEj5f2QB9jbADrlttamMLl2xB000p3veDYC");

let selectedAmount = 50;

const amountButtons = document.querySelectorAll(".amount-btn");
const customAmountInput = document.getElementById("customAmount");

// Selects the amount you want to donate 
// form the amounts already given
amountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedAmount = Number(button.dataset.amount);
    customAmountInput.value = "";

    amountButtons.forEach((b) => b.classList.remove("is-selected"));
    button.classList.add("is-selected");
  });
});

// Custom input amount
customAmountInput.addEventListener("input", (e) => {
  if (e.target.value) {
    selectedAmount = Number(e.target.value);
    amountButtons.forEach((b) => b.classList.remove("is-selected"));
  }
});


document.getElementById("donateBtn").addEventListener("click", async () => {
  const btn = document.getElementById("donateBtn");
  const recurring = document.getElementById("recurringCheck").checked; // checks if monthly paymets is checked
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
  } catch (err) { // error handling
    console.error(err);
    btn.disabled = false;
    btn.querySelector(".give-btn-label").textContent = "Continue to give";
    alert("Something went wrong. Please try again.");
  }
});