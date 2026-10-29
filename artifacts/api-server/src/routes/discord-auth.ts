import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const SESSION_COOKIE = "etm_session";
const STATE_COOKIE = "etm_oauth_state";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const STATE_SECONDS = 60 * 10;

export type EtmSessionUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  exp: number;
};

type SignedPayload = Record<string, unknown> & { exp: number };

const getSigningSecret = (): string => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for Discord login.");
  }
  return secret;
};

const sign = (payload: string): string =>
  createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");

const encodeSignedPayload = (value: SignedPayload): string => {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const decodeSignedPayload = <T extends SignedPayload>(
  token: string | undefined,
): T | null => {
  if (!token) {
    return null;
  }
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) {
    return null;
  }

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as T;
    return data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
};

const readCookie = (request: Request, name: string): string | undefined => {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) {
      continue;
    }
    if (item.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(item.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};

const cookieAttributes = (maxAge: number): string => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

const setCookie = (
  response: Response,
  name: string,
  value: string,
  maxAge: number,
): void => {
  response.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; ${cookieAttributes(maxAge)}`);
};

const clearCookie = (response: Response, name: string): void => {
  response.append("Set-Cookie", `${name}=; ${cookieAttributes(0)}`);
};

export const getEtmSessionUser = (
  request: Request,
): EtmSessionUser | null => {
  const payload = decodeSignedPayload<EtmSessionUser>(
    readCookie(request, SESSION_COOKIE),
  );
  if (
    !payload ||
    typeof payload.id !== "string" ||
    typeof payload.username !== "string"
  ) {
    return null;
  }
  return payload;
};

export const requireEtmSession = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  if (!getEtmSessionUser(request)) {
    response.status(401).json({ error: "Discord login required." });
    return;
  }
  next();
};

const getClientId = (): string => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is not configured.");
  }
  return clientId;
};

const getRedirectUri = (): string => {
  if (process.env.DISCORD_REDIRECT_URI) {
    return process.env.DISCORD_REDIRECT_URI;
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (process.env.NODE_ENV === "development" && devDomain) {
    return `https://${devDomain}/api/auth/discord/callback`;
  }
  throw new Error("DISCORD_REDIRECT_URI is not configured.");
};

const isOAuthConfigured = (): boolean =>
  Boolean(process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_CLIENT_ID);

const router = Router();

router.get("/auth/discord/start", (request, response) => {
  if (!isOAuthConfigured()) {
    response.status(503).send("Discord login is not configured yet.");
    return;
  }

  try {
    const state = randomBytes(32).toString("base64url");
    setCookie(
      response,
      STATE_COOKIE,
      encodeSignedPayload({
        state,
        exp: Math.floor(Date.now() / 1000) + STATE_SECONDS,
      }),
      STATE_SECONDS,
    );

    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.search = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: "identify",
      state,
    }).toString();
    response.redirect(302, authorizeUrl.toString());
  } catch (error) {
    logger.error({ error }, "Unable to start Discord OAuth");
    response.status(503).send("Discord login is temporarily unavailable.");
  }
});

router.get("/auth/discord/callback", async (request, response) => {
  const code = typeof request.query.code === "string" ? request.query.code : null;
  const state = typeof request.query.state === "string" ? request.query.state : null;
  const savedState = decodeSignedPayload<{ state: string; exp: number }>(
    readCookie(request, STATE_COOKIE),
  );
  clearCookie(response, STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState.state) {
    response.redirect(302, "/?discord=login-failed");
    return;
  }

  if (!isOAuthConfigured()) {
    response.redirect(302, "/?discord=login-unavailable");
    return;
  }

  try {
    const redirectUri = getRedirectUri();
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: getClientId(),
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      logger.warn(
        { status: tokenResponse.status },
        "Discord OAuth token exchange failed",
      );
      response.redirect(302, "/?discord=login-failed");
      return;
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      token_type?: string;
    };
    if (!tokenData.access_token) {
      response.redirect(302, "/?discord=login-failed");
      return;
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userResponse.ok) {
      logger.warn(
        { status: userResponse.status },
        "Discord profile request failed",
      );
      response.redirect(302, "/?discord=login-failed");
      return;
    }

    const discordUser = (await userResponse.json()) as {
      id?: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
    };
    if (!discordUser.id || !discordUser.username) {
      response.redirect(302, "/?discord=login-failed");
      return;
    }

    const avatarUrl =
      discordUser.avatar == null
        ? null
        : `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`;
    const user: EtmSessionUser = {
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name ?? null,
      avatarUrl,
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    };

    setCookie(
      response,
      SESSION_COOKIE,
      encodeSignedPayload(user),
      SESSION_SECONDS,
    );
    response.redirect(302, "/?discord=connected");
  } catch (error) {
    logger.error({ error }, "Discord OAuth callback failed");
    response.redirect(302, "/?discord=login-failed");
  }
});

router.get("/auth/session", (request, response) => {
  const user = getEtmSessionUser(request);
  if (!user) {
    response.json({ authenticated: false, user: null });
    return;
  }
  response.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      avatarUrl: user.avatarUrl,
    },
  });
});

router.post("/auth/logout", (_request, response) => {
  clearCookie(response, SESSION_COOKIE);
  response.json({ success: true });
});

export default router;
