import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../db.js";

export type AuthVariables = {
  userId: string;
  userEmail: string;
};

export type OptionalAuthVariables = {
  userId: string | null;
  userEmail: string | null;
};

async function resolveBearerUser(header: string | undefined): Promise<{
  id: string;
  email: string;
} | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    return user;
  } catch {
    return null;
  }
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const user = await resolveBearerUser(c.req.header("Authorization"));
    if (!user) {
      throw new HTTPException(401, { message: "Authentication required" });
    }
    c.set("userId", user.id);
    c.set("userEmail", user.email);
    await next();
  }
);

/** Sets userId/userEmail when a valid Bearer token is present; otherwise null. */
export const optionalAuth = createMiddleware<{
  Variables: OptionalAuthVariables;
}>(async (c, next) => {
  const user = await resolveBearerUser(c.req.header("Authorization"));
  c.set("userId", user?.id ?? null);
  c.set("userEmail", user?.email ?? null);
  await next();
});
