/** Safe, public-facing shape of a User — never includes passwordHash or internal fields. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  defaultCurrency: string;
  timezone: string;
  shareUsageAnalytics: boolean;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  isCurrent: boolean;
}
