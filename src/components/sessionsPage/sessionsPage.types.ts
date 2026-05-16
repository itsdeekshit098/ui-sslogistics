export interface UserSession {
  id: string;
  device: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  role: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  isBanned: boolean;
  bannedUntil: string | null;
  sessions: UserSession[];
}

export interface SessionsPageProps {
  className?: string;
}
