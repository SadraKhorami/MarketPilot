import {
  Activity,
  Bell,
  BellRing,
  Bookmark,
  BookOpen,
  Bot,
  CandlestickChart,
  ChartNoAxesCombined,
  Code2,
  CreditCard,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Palette,
  ScrollText,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserRound,
  Users,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Workspace",
    items: [
      { id: "dashboard", title: "Dashboard", url: "/dashboard/default", icon: LayoutDashboard },
      {
        id: "markets",
        title: "Markets",
        icon: CandlestickChart,
        subItems: [
          { id: "markets-overview", title: "Overview", url: "/dashboard/markets", icon: ChartNoAxesCombined },
          { id: "watchlist", title: "Watchlist", url: "/dashboard/watchlist", icon: Bookmark },
        ],
      },
      { id: "journal", title: "Journal", url: "/dashboard/journal", icon: BookOpen },
      { id: "ai-analyst", title: "AI Analyst", url: "/dashboard/ai-analyst", icon: Sparkles },
      { id: "news", title: "News & Sentiment", url: "/dashboard/news-and-sentiment", icon: Newspaper },
      { id: "alerts", title: "Alerts", url: "/dashboard/alerts", icon: BellRing },
    ],
  },
  {
    id: 2,
    label: "Connections",
    items: [
      {
        id: "bots",
        title: "Bots",
        icon: Bot,
        subItems: [
          { id: "telegram", title: "Telegram", url: "/dashboard/bots/telegram", icon: Send },
          { id: "discord", title: "Discord", url: "/dashboard/bots/discord", icon: MessageCircle },
        ],
      },
      {
        id: "api",
        title: "API",
        icon: KeyRound,
        subItems: [
          { id: "api-keys", title: "API Keys", url: "/dashboard/api/keys", icon: KeyRound },
          { id: "api-usage", title: "Usage", url: "/dashboard/api/usage", icon: Activity },
          { id: "api-docs", title: "Documentation", url: "/dashboard/api/documentation", icon: BookOpen },
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Account",
    items: [
      { id: "profile", title: "Profile", url: "/dashboard/profile", icon: UserRound },
      { id: "notifications", title: "Notifications", url: "/dashboard/notifications", icon: Bell },
      { id: "activity", title: "Activity", url: "/dashboard/activity", icon: Activity },
      { id: "billing", title: "Billing & plans", url: "/dashboard/billing", icon: CreditCard },
      {
        id: "settings",
        title: "Settings",
        icon: Settings2,
        subItems: [
          { id: "settings-security", title: "Security", url: "/dashboard/settings/security", icon: ShieldCheck },
          {
            id: "settings-notifications",
            title: "Notifications",
            url: "/dashboard/settings/notifications",
            icon: BellRing,
          },
          { id: "settings-appearance", title: "Appearance", url: "/dashboard/settings/appearance", icon: Palette },
        ],
      },
    ],
  },
];

if (process.env.NODE_ENV === "development") {
  sidebarItems.push({
    id: 5,
    label: "Development",
    items: [
      {
        id: "dev-docs",
        title: "Developer guide",
        icon: BookOpen,
        subItems: [
          { id: "docs-architecture", title: "Architecture", url: "/dashboard/dev-docs/architecture", icon: Layers3 },
          { id: "docs-daily", title: "Quick start", url: "/dashboard/dev-docs/daily", icon: Terminal },
          { id: "docs-setup", title: "Setup & updates", url: "/dashboard/dev-docs/setup", icon: Code2 },
          { id: "docs-bots", title: "Bots", url: "/dashboard/dev-docs/bots", icon: Bot },
          { id: "docs-billing", title: "Sandbox billing", url: "/dashboard/dev-docs/billing", icon: CreditCard },
          { id: "docs-deploy", title: "Deploy to Ubuntu", url: "/dashboard/dev-docs/deploy", icon: Server },
          {
            id: "docs-troubleshooting",
            title: "Troubleshooting",
            url: "/dashboard/dev-docs/troubleshooting",
            icon: LifeBuoy,
          },
        ],
      },
    ],
  });
}

export const adminSidebarGroup: NavGroup = {
  id: 4,
  label: "Administration",
  items: [
    { id: "admin-overview", title: "Admin overview", url: "/dashboard/admin", icon: ShieldCheck },
    { id: "admin-users", title: "Users", url: "/dashboard/admin/users", icon: Users },
    { id: "admin-requests", title: "Request logs", url: "/dashboard/admin/requests", icon: Activity },
    { id: "admin-audit", title: "Audit log", url: "/dashboard/admin/activity", icon: ScrollText },
    { id: "admin-keys", title: "API management", url: "/dashboard/admin/api-keys", icon: KeyRound },
    { id: "admin-notifications", title: "Notifications", url: "/dashboard/admin/notifications", icon: Bell },
    { id: "admin-payments", title: "Payments", url: "/dashboard/admin/payments", icon: CreditCard },
    { id: "admin-system", title: "System", url: "/dashboard/admin/system", icon: Server },
  ],
};
