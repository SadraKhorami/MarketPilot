import type { Subscription } from "@prisma/client";

export const plans = {
	FREE: {
		name: "Free",
		aiDaily: 5,
		apiDaily: 100,
		watchlists: 2,
		watchlistItems: 20,
		activeAlerts: 5,
		apiKeys: 1,
		externalAlerts: false,
	},
	PRO: {
		name: "Pro",
		aiDaily: 30,
		apiDaily: 10000,
		watchlists: 10,
		watchlistItems: 100,
		activeAlerts: 50,
		apiKeys: 5,
		externalAlerts: true,
	},
} as const;

/** Expired or unpaid subscriptions never grant paid entitlements. */
export function effectivePlan(
	subscription: Pick<
		Subscription,
		"plan" | "status" | "currentPeriodEnd"
	> | null,
	now = new Date(),
): keyof typeof plans {
	return subscription?.plan === "PRO" &&
		subscription.status === "active" &&
		subscription.currentPeriodEnd &&
		subscription.currentPeriodEnd > now
		? "PRO"
		: "FREE";
}
