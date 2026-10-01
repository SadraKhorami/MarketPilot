export type Provider = "telegram" | "discord";
export interface BotState {
  configuration: { configured: boolean };
  channel: {
    active: boolean;
    displayName: string | null;
    externalAccountId: string | null;
    verifiedAt: string | null;
    preferences: { marketAlerts?: boolean };
  } | null;
  candidate: { id: string; candidateId: string; candidateName: string | null; expiresAt: string } | null;
  installUrl: string | null;
}
export interface LinkToken {
  code: string | null;
  url: string | null;
  expiresAt: string;
}
