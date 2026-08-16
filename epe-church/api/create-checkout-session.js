import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, recurring, fund } = req.body;

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: recurring ? "subscription" : "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: fund ? `Donation - ${fund}` : "Donation",
            },
            unit_amount: Math.round(amount * 100), // cents
            ...(recurring && { recurring: { interval: "month" } }),
          },
          quantity: 1,
        },
      ],
      metadata: { fund: fund || "General" },
      return_url: `${req.headers.origin}/donate-success.html?session_id={CHECKOUT_SESSION_ID}`,
    });

    res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}