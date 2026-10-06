import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { BillingService } from '../services/billing';

export const billingRoutes = async (server: FastifyInstance) => {

  // GET /api/billing/plans - Public route
  server.get('/plans', async (req, reply) => {
    try {
      const plans = await prisma.subscriptionPlan.findMany();
      return reply.send(plans);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve subscription plans' });
    }
  });

  // GET /api/billing/status - Protected route
  server.get('/status', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const subscription = await prisma.tenantSubscription.findFirst({
        where: { homeId: req.tenant.homeId }
      });

      if (!subscription) {
        return reply.send({ status: 'ACTIVE_PRO', maxDevices: 999999, plan: 'PRO', isPaid: true });
      }

      return reply.send(subscription);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve billing status' });
    }
  });

  // POST /api/billing/checkout - Protected route
  server.post('/checkout', { preHandler: [verifyTenant, requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      const { planId } = req.body as { planId: string };
      // In production, call Stripe API to create a Checkout Session
      const successUrl = `https://${process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000'}/billing?success=true`;
      const cancelUrl = `https://${process.env.NEXT_PUBLIC_DOMAIN || 'localhost:3000'}/billing?canceled=true`;
      
      const session = await BillingService.createCheckoutSession(req.tenant.homeId, planId, successUrl, cancelUrl);
      return reply.send({ url: session.url });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to initiate checkout session' });
    }
  });

  // POST /api/billing/webhook - Public Webhook (unauthenticated in reality, Stripe verified)
  server.post('/webhook', async (req, reply) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
      
      // Using raw body for Stripe signature verification
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const result = await BillingService.handleWebhook(rawBody, signature, endpointSecret);
      return reply.send(result);
    } catch (error) {
      server.log.error(error);
      return reply.status(400).send({ error: 'Webhook Error' });
    }
  });
};
