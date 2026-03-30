import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            tier: "PRO",
            stripeCustomerId: session.customer,
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const customerId = subscription.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (user && user.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: user.id },
          data: { tier: "FREE" },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as any;
      const customerId = invoice.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (user && user.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: user.id },
          data: { tier: "FREE" },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
