import { SignJWT, jwtVerify } from "jose";
import { env } from "../env.js";

const encoder = new TextEncoder();
const secret = encoder.encode(env.JWT_SECRET);

export type JwtPayload = {
  sub: string;
  email: string;
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: payload.sub, email: payload.email };
}
