interface DeploymentStep {
  title: string;
  description: string;
  code?: string;
}
interface DeploymentChapter {
  id: string;
  title: string;
  description: string;
  steps: DeploymentStep[];
}

const compose = "docker compose --env-file /etc/marketpilot/production/compose.env -f compose.production.yaml";

export const deploymentChapters: DeploymentChapter[] = [
  {
    id: "prepare",
    title: "Prepare Ubuntu & domains",
    description: "Host, access and the deployment boundary",
    steps: [
      {
        title: "Choose a supported Ubuntu LTS",
        description:
          "Use a supported release from Docker’s Ubuntu compatibility list. Install Docker Engine, Buildx and the Compose plugin from its official repository; install Nginx on the host. Size CPU, RAM and disk for observed load, builds, PostgreSQL and Redis. Node/pnpm are not required to run the production containers.",
        code: "sudo apt update\nsudo apt install nginx\ndocker version\ndocker compose version\ndocker buildx version",
      },
      {
        title: "Keep operator access deliberate",
        description:
          "Use an SSH key and a dedicated deployment account. Allow your SSH port before enabling the firewall. Expose HTTPS and the chosen certificate-validation path only; database and Redis ports stay private. Docker access grants powerful host privileges. Keep Ubuntu security updates, disk alerts and protected repository access configured.",
      },
      {
        title: "Use sibling HTTPS domains",
        description:
          "Point app.example.com and api.example.com at the server. Replace every example domain. Sibling domains support the current secure cookie design; unrelated domains need an authentication review. Deploy a pinned Git revision in a separate server checkout. Use a separate staging Compose project, volumes, secrets and bot identities before production.",
      },
    ],
  },
  {
    id: "configure",
    title: "Configure services & secrets",
    description: "Protected files outside the repository",
    steps: [
      {
        title: "Start from the production templates",
        description:
          "Create protected configuration files outside the checkout. Fill their placeholders manually from your secret store. Never upload your laptop .env or commit credentials. Restrict files to the operator; ensure Docker can read mounted secrets.",
        code: 'sudo install -d -m 700 -o "$(id -un)" -g "$(id -gn)" /etc/marketpilot/production\ninstall -m 600 docker/compose.env.example /etc/marketpilot/production/compose.env\ninstall -m 600 docker/api.env.example /etc/marketpilot/production/api.env\ninstall -m 600 docker/worker.env.example /etc/marketpilot/production/worker.env\ninstall -m 600 docker/migration.env.example /etc/marketpilot/production/migration.env',
      },
      {
        title: "Connect the private data layer",
        description:
          "Set COMPOSE_PROJECT_NAME=marketpilot-production, file paths under /etc/marketpilot/production and strong, independently generated PostgreSQL / Redis passwords in protected secret files. DATABASE_URL uses postgres:5432; REDIS_URL uses redis:6379 in the Compose network. URL-encode passwords. Separate database migration and runtime roles with the required grants; do not expose ports 5432 or 6379.",
      },
      {
        title: "Set domains before building",
        description:
          "In compose.env set NEXT_PUBLIC_APP_URL=https://app.example.com and NEXT_PUBLIC_API_URL=https://api.example.com/api/v1. API WEB_ORIGIN must be the exact app HTTPS origin. These public web values are baked into the image: rebuild Web when they change. Set only the actual trusted proxy IP/CIDR observed by the API; never enable blanket TRUST_PROXY.",
      },
      {
        title: "Enable integrations intentionally",
        description:
          "Configure all required OpenRouter fields together, including model and budget limits. API and Worker need the appropriate bot credentials and the same durable bot payload encryption key. Use stable BOT_WEB_URL and BOT_API_URL. Payments currently support disabled, demo or stripe_test modes only: this release cannot accept live Stripe payments. Keep staging and production secrets independent.",
      },
    ],
  },
  {
    id: "release",
    title: "Build, migrate & start",
    description: "A repeatable release sequence",
    steps: [
      {
        title: "Build the selected revision",
        description:
          "Run from the repository root. Review configuration without printing secret values. Use only compose.production.yaml; do not merge the development Compose file. Build all four targets on the target Linux architecture or use reviewed matching images. Record the Git revision and immutable image IDs for rollback.",
        code: `${compose} --profile tools config --quiet\n${compose} --profile tools build --pull api worker web migrate`,
      },
      {
        title: "Start data services, then apply migrations",
        description:
          "For an existing database, take a verified backup first. The migration image applies committed migrations; app startup does not. Never run development seeds or migrate reset against production. Review compatibility before starting new API/Worker code.",
        code: `${compose} up -d --wait postgres redis\n${compose} --profile tools run --rm migrate`,
      },
      {
        title: "Start the application",
        description:
          "Web binds to 127.0.0.1:8080 and API to 127.0.0.1:8081 by default. Worker remains private. Provision an administrator by reviewing an existing verified account; do not use a default bootstrap password.",
        code: `${compose} up -d --wait api worker web\n${compose} ps`,
      },
    ],
  },
  {
    id: "edge",
    title: "Nginx, HTTPS & Cloudflare",
    description: "Protect the origin without breaking sessions or streaming",
    steps: [
      {
        title: "Install certificates before enabling strict TLS",
        description:
          "Adapt docker/nginx.conf.example with your two domains and certificate paths. It belongs in Nginx’s http context. Provision a valid public certificate with automated renewal, or a Cloudflare Origin CA certificate when the origin is only reached through Cloudflare. Origin CA is not trusted by ordinary browsers connecting directly. DNS validation can keep the origin restricted during issuance. Enable Cloudflare Full (strict) after origin HTTPS works.",
      },
      {
        title: "Preserve the existing proxy behavior",
        description:
          "The supplied template routes Web to :8080 and /api/v1/ to :8081, replaces forwarded headers/request IDs and disables API response buffering for research streaming. Keep raw webhook bodies and signatures intact. Test certificate renewal and reload only valid configuration. Keep a DNS-only validation phase until ingress works.",
        code: "sudo nginx -t\nsudo systemctl reload nginx",
      },
      {
        title: "Restore client IPs through a trusted edge",
        description:
          "Before proxying DNS, configure Nginx set_real_ip_from with Cloudflare’s current official IPv4 and IPv6 ranges and real_ip_header CF-Connecting-IP. Restrict origin ingress to that edge, with an explicit certificate-validation arrangement. Update the ranges over time. Otherwise all clients can share one edge IP rate bucket. API TRUST_PROXY must trust its actual Nginx/Docker gateway peer, not arbitrary incoming headers.",
      },
      {
        title: "Cache static assets; bypass private traffic",
        description:
          "Add explicit cache bypass rules for the API hostname, authentication, dashboard HTML and streaming. Cache immutable /_next/static assets according to response headers. Do not apply Cache Everything to authenticated pages or API responses. Scope WAF/challenge exceptions to provider webhook routes; keep application signature checks and other protections. Check Cloudflare timeout limits: increasing Nginx’s timeout does not extend the edge limit. Verify first-event latency, reconnects and long research responses.",
      },
    ],
  },
  {
    id: "integrations",
    title: "Cut over bots & billing",
    description: "Stable provider endpoints replace the local tunnel",
    steps: [
      {
        title: "Register Telegram & Discord",
        description:
          "ngrok is for local development; a stable HTTPS API domain replaces it here. From a protected operator checkout with Node 24.20+ (24.x), pnpm 10.26, frozen dependencies installed and the @marketpilot/bots package built, run the existing registration helpers. Confirm BOT_API_URL=https://api.example.com/api/v1 and BOT_WEB_URL=https://app.example.com. Create a mode-600 bot-setup.env outside the repository with the provider setup values. The Discord Developer Portal interactions endpoint must match setup output. Register each environment with its own bot/application; one Telegram bot has one webhook.",
        code: "node --env-file=/etc/marketpilot/production/bot-setup.env packages/bots/dist/setup.js telegram\nnode --env-file=/etc/marketpilot/production/bot-setup.env packages/bots/dist/setup.js discord",
      },
      {
        title: "Finish account linking and delivery",
        description:
          "Open the bot page in the dashboard, complete the Telegram deep link or Discord slash-command link and confirm the displayed identity. Discord /link is a registered slash command with a code field, not a plain text message. Check authorized command responses, typing/deferred feedback and a confirmed alert delivery. External alert delivery also depends on plan entitlement and notification preferences.",
      },
      {
        title: "Register the sandbox billing webhook",
        description:
          "Prepare /etc/marketpilot/production/.env with mode 600, a test Stripe key and BILLING_WEBHOOK_API_URL=https://api.example.com. Run from that protected directory because the helper saves its signing secret to the current directory’s .env. Replace /opt/marketpilot with your operator checkout path, with dependencies installed. Transfer the saved secret and endpoint ID securely to api.env, then recreate API. This configures sandbox billing only; API readiness must already respond.",
        code: "cd /etc/marketpilot/production\nnode --env-file=.env /opt/marketpilot/apps/api/scripts/setup-billing-webhook.mjs",
      },
    ],
  },
  {
    id: "operations",
    title: "Verify, back up & update",
    description: "Operate the release after it starts",
    steps: [
      {
        title: "Check readiness and actual flows",
        description:
          "API readiness checks database/Redis; Web health checks its process; Worker readiness also checks consumers. Inspect /dashboard/admin/system, then verify login, market freshness, AI streaming, account linking and authorized webhook delivery in staging. Container health does not establish provider acceptance. Docker restart policies restart exited processes, not merely unhealthy ones. Monitor failures, queue age, disk, memory and certificate expiry.",
      },
      {
        title: "Back up PostgreSQL off the host",
        description:
          "Create the restricted backup directory before running. Encrypt backups, transfer them off-server and define retention/RPO/RTO. Preserve database roles and the bot encryption key separately. Restore drills must use a new isolated project with applications stopped; do not overwrite current volumes. Redis AOF needs its own consistent maintenance backup procedure, not a copy of a changing directory.",
        code: `umask 077\n${compose} exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /secure/backups/marketpilot.dump`,
      },
      {
        title: "Roll forward with a recovery plan",
        description:
          "Stage the pinned revision, back up, build, migrate and recreate services with the release sequence above. This single-host topology can have brief downtime; it is not a zero-downtime deployment. Roll back images only when the database schema remains compatible. Otherwise use a reviewed forward fix or isolated restore. Do not run down -v. Logs must omit tokens, cookies, prompts and webhook bodies; use request IDs and rotating retention. CI validates/builds images but does not deploy this server automatically.",
      },
    ],
  },
];

export const deploymentReferences = [
  { label: "Nginx proxy", href: "https://nginx.org/en/docs/http/ngx_http_proxy_module.html" },
  { label: "Certificate setup", href: "https://certbot.eff.org/instructions" },
  { label: "PostgreSQL backups", href: "https://www.postgresql.org/docs/16/backup-dump.html" },
  { label: "Docker on Ubuntu", href: "https://docs.docker.com/engine/install/ubuntu/" },
  {
    label: "Cloudflare strict TLS",
    href: "https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/",
  },
  { label: "Cloudflare IP ranges", href: "https://www.cloudflare.com/ips/" },
  { label: "Cache rules", href: "https://developers.cloudflare.com/cache/how-to/cache-rules/settings/" },
  {
    label: "Edge timeouts",
    href: "https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/",
  },
];
