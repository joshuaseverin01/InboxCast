import type { DefaultSession } from "next-auth";

type GoogleSessionConnection = {
  connected: boolean;
  grantedScopes: string;
  expiresAt?: number;
};

type GoogleTokenConnection = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
};

declare module "next-auth" {
  interface Session {
    google?: GoogleSessionConnection;
    user?: DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    google?: GoogleTokenConnection;
  }
}
