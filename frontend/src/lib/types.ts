export type UserRole = "SUPER_ADMIN" | "STORE_OWNER" | "STORE_STAFF";

export type BillingGateway = "STRIPE" | "MERCADO_PAGO" | "TRIAL";

export type Plan = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  vehicleLimit: number | null;
  userLimit: number | null;
  maxPhotosPerVehicle: number | null;
  allowCustomDomain: boolean;
  removeWatermark: boolean;
  includeReports: boolean;
  includeAdvancedReports: boolean;
  allowOutboundWebhooks: boolean;
  trialDays: number | null;
  isTrial: boolean;
  showTrialBanner: boolean;
  isActive: boolean;
  sortOrder: number;
  stripePriceId: string | null;
  mercadopagoPlanId: string | null;
};

export type Subscription = {
  id: string;
  status: string;
  gateway: BillingGateway | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
};

export type PlanUsage = {
  plan: Plan | null;
  subscription: Subscription | null;
  usage: {
    vehicles: {
      used: number;
      limit: number | null;
    };
    users: {
      used: number;
      limit: number | null;
    };
    photosPerVehicle: {
      limit: number | null;
    };
  };
  trial: {
    isTrialing: boolean;
    trialEndsAt: string | null;
  };
};

export type Store = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme: "LIGHT" | "DARK" | "LUXURY";
  city?: string | null;
  state?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  description?: string | null;
  slogan?: string | null;
  aboutUs?: string | null;
  openingHours?: string | null;
  address?: string | null;
  mapEmbedUrl?: string | null;
  isActive: boolean;
  unavailableMessage?: string | null;
  onboardingCompleted: boolean;
  subscriptions?: Subscription[];
  planUsage?: PlanUsage;
};

export type VehicleImage = {
  id: string;
  url: string;
  isCover: boolean;
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  mileage: number;
  fuel: "FLEX" | "GASOLINE" | "DIESEL" | "ELECTRIC" | "HYBRID";
  transmission: "MANUAL" | "AUTOMATIC" | "CVT" | "AUTOMATED";
  price: string;
  description: string;
  optionalItems: string[];
  status: "AVAILABLE" | "SOLD" | "RESERVED";
  featured: boolean;
  images: VehicleImage[];
  createdAt: string;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  message: string;
  createdAt: string;
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
  } | null;
};