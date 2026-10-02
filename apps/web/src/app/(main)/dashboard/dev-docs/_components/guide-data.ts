export interface GuideStep {
  title: string;
  description: string;
  code?: string;
  note?: string;
  link?: { label: string; href: string };
}
export interface Guide {
  id: "daily" | "setup" | "bots" | "billing";
  label: string;
  title: string;
  description: string;
  steps: GuideStep[];
}

export const guides: Guide[] = [
  {
    id: "daily",
    label: "Quick start",
    title: "One command. Your local workspace.",
    description:
      "Start from the repository root. The launcher prepares local services and keeps their status up to date.",
    steps: [
      {
        title: "Start everything",
        description:
          "Starts Colima when needed, waits for PostgreSQL and Redis, builds shared packages and applies migrations before starting a new API. Then prepares the API tunnel and configured integrations, followed by the worker and dashboard.",
        code: "pnpm dev:full",
        note: "Install dependencies once with pnpm install --frozen-lockfile. Configure .env, Docker/Colima and ngrok's authtoken first. Existing services are reused; stop an existing API before running this command if migrations are pending. No database reset or automatic seed.",
        link: { label: "Open dashboard", href: "/dashboard/default" },
      },
      {
        title: "Check service status",
        description:
          "Inspect local containers, dashboard, API, worker and the public API tunnel. The panel above reads the launcher's latest snapshot; stale snapshots are marked rather than presented as live.",
        code: "pnpm dev:status",
        note: "Integration status confirms configuration synchronization, not message delivery. Detailed queues, bot failures and provider checks are in System.",
        link: { label: "Open system status", href: "/dashboard/admin/system" },
      },
      {
        title: "Use the integrations",
        description:
          "Configured Telegram and Discord bots synchronize with the current tunnel. Stripe sandbox keeps its existing endpoint and signing secret when the tunnel changes. User account linking and alert preferences still happen in the dashboard.",
        note: "Keep dev:full open. Ctrl+C stops only processes launched by this command; containers, saved data and an existing tunnel are preserved. If ngrok's URL changes later, rerun dev:full. Missing credentials leave that integration unconfigured.",
        link: { label: "Connect bots", href: "/dashboard/bots/telegram" },
      },
      {
        title: "Dashboard without integrations",
        description:
          "The manual startup commands remain available when you want to control individual processes. A public tunnel is only needed for inbound bot and Stripe webhooks.",
        code: "pnpm dev:infra\npnpm dev",
        note: "dev:full requires local database and Redis URLs and API port 4000. It refuses production configuration.",
      },
    ],
  },
  {
    id: "setup",
    label: "Setup & updates",
    title: "Prepare once. Update when needed.",
    description: "These commands prepare dependencies and the database; they are not extra services to leave running.",
    steps: [
      {
        title: "First installation",
        description:
          "Install Node.js 24.20+ (24.x), pnpm 10.26.0 and Docker Compose. Create .env from .env.example only if .env does not already exist; keep your current credentials.",
        code: "pnpm install --frozen-lockfile\npnpm dev:infra\npnpm db:generate\npnpm db:deploy",
        note: "pnpm dev builds shared workspace packages before starting the applications.",
      },
      {
        title: "After pulling an update",
        description:
          "Install the pinned dependencies, regenerate the database client and apply pending migrations. Restart pnpm dev afterward.",
        code: "pnpm install --frozen-lockfile\npnpm db:generate\npnpm db:deploy",
        note: "db:deploy applies checked-in migrations. It does not reset the database. No need to repeat this before every dev session.",
      },
      {
        title: "Create an administrator if needed",
        description:
          "Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the local .env, then seed. Existing account passwords are not overwritten.",
        code: "pnpm db:seed",
        note: "Skip this if your administrator account already exists.",
      },
      {
        title: "Enable AI research",
        description:
          "Set OPENROUTER_API_KEY and OPENROUTER_MODEL in .env. The chosen catalog model must support tools and structured outputs. Restart the API after changing configuration.",
        link: { label: "Open AI Analyst", href: "/dashboard/ai-analyst" },
        note: "Research needs an internet connection and provider credit. Daily plan allowances and provider spending safeguards are separate.",
      },
    ],
  },
  {
    id: "bots",
    label: "Telegram & Discord",
    title: "Bring your workspace into chat.",
    description:
      "Use one API tunnel for both platforms. Configure the platform bots on the server, then link each user's account in the dashboard.",
    steps: [
      {
        title: "Set the public API URL",
        description:
          "Replace YOUR-NGROK-HOST with the HTTPS hostname shown by ngrok. Keep secrets in the local .env, never in .env.example.",
        code: "BOT_API_URL=https://YOUR-NGROK-HOST/api/v1\nBOT_WEB_URL=http://localhost:3000",
        note: "BOT_WEB_URL opens dashboard links on this computer. To use those links on another device, expose the frontend separately and configure its URL and allowed origins.",
      },
      {
        title: "Register Telegram",
        description:
          "Configure TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME (without @), TELEGRAM_WEBHOOK_SECRET and BOT_PAYLOAD_KEY. This command registers private commands and the webhook.",
        code: "pnpm bots:setup telegram",
        link: { label: "Connect Telegram", href: "/dashboard/bots/telegram" },
        note: "Open the bot using the dashboard's linking flow, then return to the dashboard and confirm the displayed identity.",
      },
      {
        title: "Register Discord",
        description:
          "Configure DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_PUBLIC_KEY and BOT_PAYLOAD_KEY. Register the slash commands, then set Interactions Endpoint URL in the Discord Developer Portal.",
        code: "pnpm bots:setup discord",
        note: "Interactions Endpoint URL: https://YOUR-NGROK-HOST/api/v1/bot-webhooks/discord. Install the application with bot and applications.commands scopes.",
        link: { label: "Connect Discord", href: "/dashboard/bots/discord" },
      },
      {
        title: "Link privately and try a command",
        description:
          "In Discord, choose the registered /link slash command in the bot's DM and put the one-time dashboard code in its code field. A normal /link message in a server channel will not link your account.",
        code: "/price BTC\n/analyze XAUUSD",
        note: "These are examples of separate bot commands, not shell commands. In Discord use the slash-command symbol field. Linking and ordinary commands work on Free; AI commands share your research quota.",
      },
      {
        title: "Enable external alert delivery",
        description:
          "Activate test Pro, confirm the platform link and enable its market-alert preference. Create an enabled alert rule; a new threshold crossing produces a notification.",
        link: { label: "Manage alerts", href: "/dashboard/alerts" },
        note: "Old triggers are not resent after enabling a channel. After changing .env, restart pnpm dev. Re-register webhooks whenever the tunnel URL changes.",
      },
    ],
  },
  {
    id: "billing",
    label: "Stripe",
    title: "Explore billing without live payments.",
    description:
      "Sandbox payments verify plans and allowances. MarketPilot rejects live Stripe keys and never collects real money in this implementation.",
    steps: [
      {
        title: "Choose a billing mode",
        description:
          "Use demo for a credential-free 30-day Pro activation, stripe_test for hosted sandbox Checkout, or disabled to keep subscription changes unavailable.",
        code: "BILLING_MODE=stripe_test",
        note: "Stripe mode also requires STRIPE_SECRET_KEY with an sk_test_ prefix in .env. A publishable key is not needed for hosted Checkout.",
      },
      {
        title: "Register the sandbox webhook",
        description:
          "With the API and its HTTPS tunnel running, this command checks public readiness and saves the webhook secret directly in the local .env. Restart pnpm dev afterward.",
        code: "pnpm billing:setup-webhook",
        note: "The helper discovers ngrok on port 4040. For another inspector or public host, set BILLING_WEBHOOK_API_URL=https://YOUR-NGROK-HOST (without /api/v1). A changed tunnel URL requires registration again.",
      },
      {
        title: "Try checkout and cancellation",
        description:
          "Open Billing → Plans → Open test checkout. Use Stripe's sandbox payment details. Return to Billing to inspect Pro access, usage and History, then try Cancel Pro and Keep Pro.",
        link: { label: "Open Billing", href: "/dashboard/billing" },
        note: "Cancellation preserves Pro until the period ends. Refresh status can verify a payment if the redirect was interrupted; webhooks synchronize changes while the dashboard is closed.",
      },
      {
        title: "Review as an administrator",
        description:
          "Payments shows the sandbox ledger and subscription directory. System shows dependencies, job queues and provider configuration.",
        link: { label: "Open test payments", href: "/dashboard/admin/payments" },
        note: "Admin routes require an administrator account. Sandbox amounts are not live revenue.",
      },
    ],
  },
];

export const troubleshooting = [
  {
    question: "The API or dashboard will not start",
    answer:
      "Check docker ps, then run pnpm db:generate and pnpm db:deploy after updates. Make sure ports 3000 and 4000 are not occupied by a second dev session. Read the first error in the pnpm dev terminal.",
  },
  {
    question: "Bots stopped replying after restarting ngrok",
    answer:
      "Update BOT_API_URL, re-register Telegram and update Discord's Interactions Endpoint URL. Keep the API tunnel running. Changing a webhook URL affects the same platform bot wherever it is installed.",
  },
  {
    question: "The webhook returns 404",
    answer:
      "Point ngrok at API port 4000, not frontend port 3000. Verify /api/v1/health/ready on the public hostname. Check that the updated API is running and migrations are applied.",
  },
  {
    question: "System says Needs attention, but Redis is healthy",
    answer:
      "Open System → Jobs and select the affected queue with Failed status. Historical failed jobs can keep the warning visible after the cause is fixed. Delayed jobs can be normal scheduled work; inspect the failure reason before retrying or removing anything.",
  },
  {
    question: "Research has reached a budget or allowance",
    answer:
      "Billing shows your plan's daily research allowance, which resets at 00:00 UTC. The AI provider also has independent spending, rate and concurrency safeguards. Changing the provider token does not reset these application counters.",
  },
  {
    question: "An alert did not arrive in Telegram or Discord",
    answer:
      "Check Pro access, verified account linking, market-alert preferences and an enabled rule. The alert needs a new threshold crossing after its baseline; it does not fire merely because the current price already exceeds the threshold. Inspect external delivery in System → Bots and Jobs.",
  },
  {
    question: "Can I turn off the tunnel or close the laptop?",
    answer:
      "The dashboard can run locally without a tunnel. Incoming bot commands and Stripe webhooks require the API and public tunnel to stay reachable. Sleep can interrupt local processing; locking the display is different from sleeping the computer.",
  },
];
