import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "MarketPilot",
  version: packageJson.version,
  copyright: `© ${currentYear}, MarketPilot.`,
  meta: {
    title: "MarketPilot · AI-powered market intelligence",
    description: "AI-powered market intelligence for tracking assets, trends, news, sentiment, and alerts.",
  },
};
