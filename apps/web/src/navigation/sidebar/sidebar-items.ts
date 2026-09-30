import {
  Activity,
  BellRing,
  Bookmark,
  Bot,
  CandlestickChart,
  ChartNoAxesCombined,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Palette,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
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
      { id: "analytics", title: "Analytics", url: "/dashboard/analytics", icon: ChartNoAxesCombined },
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
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Account",
    items: [
      { id: "profile", title: "Profile", url: "/dashboard/profile", icon: UserRound },
      { id: "activity", title: "Activity", url: "/dashboard/activity", icon: Activity },
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
