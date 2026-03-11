import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

const MERCADOPAGO_API = "https://api.mercadopago.com";

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  payment_method_id?: string;
  payment_type_id?: string;
  date_approved?: string | null;
  date_created?: string;
  external_reference?: string;
  metadata?: Record<string, string>;
};

function getWebhookUrl() {
  return env.MERCADOPAGO_WEBHOOK_URL || `${env.APP_URL}/api/subscriptions/webhook/mercadopago`;
}

function assertMercadoPagoAccessToken() {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new AppError("MERCADOPAGO_ACCESS_TOKEN nao configurado", 500);
  }

  return env.MERCADOPAGO_ACCESS_TOKEN;
}

async function mercadopagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = assertMercadoPagoAccessToken();

  const response = await fetch(`${MERCADOPAGO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(`Falha na API do Mercado Pago (${response.status})`, 502, body);
  }

  return (await response.json()) as T;
}

export async function createMercadoPagoPreference(input: {
  planId: string;
  planName: string;
  amountCents: number;
  storeId: string;
  ownerEmail: string;
  successUrl: string;
  cancelUrl: string;
  pendingUrl?: string;
  externalReference: string;
}) {
  const payload = {
    items: [
      {
        id: input.planId,
        title: `Assinatura ${input.planName} - VitrineAuto`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number((input.amountCents / 100).toFixed(2))
      }
    ],
    payer: {
      email: input.ownerEmail
    },
    external_reference: input.externalReference,
    metadata: {
      storeId: input.storeId,
      planId: input.planId
    },
    notification_url: getWebhookUrl(),
    back_urls: {
      success: input.successUrl,
      failure: input.cancelUrl,
      pending: input.pendingUrl || input.successUrl
    },
    auto_return: "approved"
  };

  const response = await mercadopagoRequest<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return {
    id: response.id,
    checkoutUrl: response.init_point
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  return mercadopagoRequest<MercadoPagoPaymentResponse>(`/v1/payments/${paymentId}`);
}

export function validateMercadoPagoWebhookSignature(params: {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
}) {
  if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
    throw new AppError("MERCADOPAGO_WEBHOOK_SECRET nao configurado", 500);
  }

  const signature = params.signatureHeader;
  if (!signature) {
    throw new AppError("Assinatura do webhook Mercado Pago ausente", 400);
  }

  const parts = signature.split(",").map((item) => item.trim());
  const tsPart = parts.find((item) => item.startsWith("ts="));
  const v1Part = parts.find((item) => item.startsWith("v1="));

  if (!tsPart || !v1Part) {
    throw new AppError("Formato de assinatura do Mercado Pago invalido", 400);
  }

  const ts = tsPart.split("=")[1];
  const hash = v1Part.split("=")[1];
  const requestId = params.requestId || "";
  const dataId = params.dataId || "";

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const generated = crypto
    .createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  if (generated.length !== hash.length) {
    throw new AppError("Assinatura do webhook Mercado Pago invalida", 400);
  }

  const valid = crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(hash));

  if (!valid) {
    throw new AppError("Assinatura do webhook Mercado Pago invalida", 400);
  }
}
