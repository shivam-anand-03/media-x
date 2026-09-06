export interface UserPayload {
  userId: string;
}

export interface SessionUser {
  id: string;
  email?: string;
  role: string;
  firstName?: string;
  lastName?: string;
  tokenVersion?: number;
}

