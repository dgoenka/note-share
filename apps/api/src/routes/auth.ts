import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, registerSchema } from "@note-share/shared";
import type { AuthResponse, PublicUser } from "@note-share/shared";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db.js";
import { hashSecret, verifySecret } from "../lib/crypto.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

authRoutes.post(
  "/register",
  zValidator("json", registerSchema),
  async (c) => {
    const body = c.req.valid("json");
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      throw new HTTPException(409, { message: "Email is already registered" });
    }

    const passwordHash = await hashSecret(body.password);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
      },
    });

    const token = await signToken({ sub: user.id, email: user.email });
    const response: AuthResponse = {
      user: toPublicUser(user),
      token,
    };
    return c.json(response, 201);
  }
);

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  });

  // Constant-ish failure message — do not reveal which field failed
  if (!user || !(await verifySecret(body.password, user.passwordHash))) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  const token = await signToken({ sub: user.id, email: user.email });
  const response: AuthResponse = {
    user: toPublicUser(user),
    token,
  };
  return c.json(response);
});

authRoutes.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HTTPException(401, { message: "Invalid session" });
  }
  const noteCount = await prisma.note.count({ where: { ownerId: userId } });
  return c.json({ user: toPublicUser(user), noteCount });
});
