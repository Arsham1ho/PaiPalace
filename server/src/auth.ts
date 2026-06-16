import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma, jsonSafe } from "./db.js";
import { env } from "./env.js";

export const authRouter = Router();

export interface AuthedRequest extends Request {
  userId?: string;
}

function sign(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "30d" });
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24),
  password: z.string().min(6),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, username, password } = parsed.data;

  const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (exists) return res.status(409).json({ error: "Email or username already in use" });

  // Only the designated owner email becomes admin. Everyone else is a normal user.
  const isAdmin = env.ADMIN_EMAIL !== "" && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      walletAddress: null, // linked when the user connects their Phantom wallet
      balance: 0n,
      isAdmin,
    },
  });
  res.json({ token: sign(user.id), user: publicUser(user) });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid credentials" });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.banned) return res.status(403).json({ error: "This account has been suspended." });
  res.json({ token: sign(user.id), user: publicUser(user) });
});

authRouter.get("/me", authMiddleware, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: publicUser(user) });
});

export function publicUser(u: any) {
  return jsonSafe({
    id: u.id,
    email: u.email,
    username: u.username,
    walletAddress: u.walletAddress,
    balance: u.balance,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
  });
}

// Guard for admin-only routes. Use after authMiddleware.
export async function adminMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user?.isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
}
