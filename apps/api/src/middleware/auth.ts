import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../db.js";

export type AuthVariables = {
  userId: string;
  userEmail: string;
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Authentication required" });
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new HTTPException(401, { message: "Authentication required" });
    }

    try {
      const payload = await verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true },
      });
      if (!user) {
        throw new HTTPException(401, { message: "Invalid session" });
      }
      c.set("userId", user.id);
      c.set("userEmail", user.email);
      await next();
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }
  }
);
