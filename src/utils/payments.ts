import { createServerFn } from "@tanstack/react-start";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), ".data", "users.json");

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  subscriptionTier: "free" | "premium";
  createdAt: string;
}

function getUsers(): StoredUser[] {
  try {
    if (existsSync(DB_PATH)) {
      return JSON.parse(readFileSync(DB_PATH, "utf-8")) as StoredUser[];
    }
  } catch { /* ignore */ }
  return [];
}

function saveUsers(users: StoredUser[]) {
  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

// Products & Pricing
export const PRODUCTS = {
  fullAccess: {
    id: "full_access",
    name: "LockBuilder Full Access",
    description: "Unlock the complete part number builder with all manufacturers, series, and cross-references.",
    price: "$5.00",
    type: "one-time" as const,
    stripeLink: "https://buy.stripe.com/test_placeholder_full_access",
  },
  adFree: {
    id: "ad_free",
    name: "LockBuilder Ad-Free",
    description: "Remove all advertisements from the app for a clean, distraction-free experience.",
    price: "$2.00/month",
    type: "subscription" as const,
    stripeLink: "https://buy.stripe.com/test_placeholder_adfree",
  },
};

// Mark the stripe payment link — the lead will replace with real links
export function getPaymentLink(productId: string, userId: string): string {
  const product = Object.values(PRODUCTS).find((p) => p.id === productId);
  if (!product) return "#";
  // The lead will replace these with real Stripe checkout links
  // The userId is appended so the webhook can identify the user
  return `${product.stripeLink}?client_reference_id=${userId}`;
}

// Server function to upgrade a user's subscription tier
export const upgradeSubscription = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { userId: string; tier: "premium" } }) => {
    const { userId, tier } = data;
    const users = getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { ok: false, error: "User not found" };
    users[idx].subscriptionTier = tier;
    saveUsers(users);
    return { ok: true, user: { id: users[idx].id, email: users[idx].email, name: users[idx].name, tier: users[idx].subscriptionTier } };
  },
);

// Server function to get user's current tier
export const getUserTier = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { userId: string } }) => {
    const { userId } = data;
    const users = getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return { ok: false, tier: "free" };
    return { ok: true, tier: user.subscriptionTier };
  },
);