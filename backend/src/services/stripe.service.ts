import Stripe from "stripe";
import { env } from "../config/env";

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia"
    })
  : null;

export function assertStripe() {
  if (!stripe) {
    throw new Error("Stripe nao configurado. Defina STRIPE_SECRET_KEY.");
  }
  return stripe;
}