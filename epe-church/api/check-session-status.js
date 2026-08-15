import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: "Missing session_id" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    res.status(200).json({
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      fund: session.metadata?.fund || "General",
      recurring: session.mode === "subscription",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}