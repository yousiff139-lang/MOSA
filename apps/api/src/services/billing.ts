import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_123', {
  apiVersion: '2025-02-24.acacia' as any,
});

export const BillingService = {
  /**
   * Creates a Stripe Checkout Session for a given Home ID.
   * This allows the tenant to upgrade to premium tiers.
   */
  createCheckoutSession: async (homeId: string, priceId: string, successUrl: string, cancelUrl: string) => {
    // Determine the customer email (get the owner of the home)
    const home = await prisma.home.findUnique({
      where: { id: homeId },
      include: { owner: true }
    });

    if (!home || !home.owner) throw new Error('Home or Home Owner not found');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: home.owner.username,
      metadata: {
        homeId: home.id,
      },
    });

    return { sessionId: session.id, url: session.url };
  },

  /**
   * Handles Stripe Webhooks to activate the subscription in our DB
   */
  handleWebhook: async (payload: any, signature: string, endpointSecret: string) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err: any) {
      throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const homeId = session.metadata?.homeId;
      const subscriptionId = session.subscription as string;

      if (homeId && subscriptionId) {
        // Upgrade the home metadata with the premium subscription ID
        await prisma.home.update({
          where: { id: homeId },
          data: {
            features: {
              subscriptionId: subscriptionId,
              plan: 'Premium',
              active: true
            }
          } as any
        });
        console.log(`[Billing] Activated subscription ${subscriptionId} for Home ${homeId}`);
      }
    }
    
    return { received: true };
  }
};
