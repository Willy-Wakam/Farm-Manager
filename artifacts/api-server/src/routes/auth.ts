import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

async function verifyPassword(stored: string, input: string): Promise<boolean> {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
    return bcrypt.compare(input, stored);
  }
  return stored === input;
}

async function migratePasswordIfNeeded(userId: number, stored: string, plaintext: string) {
  if (!stored.startsWith("$2a$") && !stored.startsWith("$2b$")) {
    const hashed = await bcrypt.hash(plaintext, 10);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, userId));
  }
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Identifiant et mot de passe requis" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.username, username));
  const user = users[0];

  if (!user || !(await verifyPassword(user.password, password))) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  await migratePasswordIfNeeded(user.id, user.password, password);

  (req.session as any).userId = user.id;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      nom: user.nom,
    },
  });
});

router.post("/register", async (req, res) => {
  const { nom, username, password } = req.body;
  if (!nom || !username || !password) {
    res.status(400).json({ error: "Nom, identifiant et mot de passe requis" });
    return;
  }
  if (username.length < 3) {
    res.status(400).json({ error: "L'identifiant doit contenir au moins 3 caractères" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const rows = await db.insert(usersTable).values({
    nom,
    username,
    password: hashed,
    role: "lecteur",
  }).returning();

  res.status(201).json({ success: true, user: { id: rows[0].id, username: rows[0].username, role: rows[0].role, nom: rows[0].nom } });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/me", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const user = users[0];

  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    nom: user.nom,
  });
});

router.get("/users", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!currentUser[0] || currentUser[0].role !== "admin") {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  const allUsers = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    nom: usersTable.nom,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable);

  res.json(allUsers);
});

router.put("/users/:id/role", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!currentUser[0] || currentUser[0].role !== "admin") {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  const targetId = parseInt(req.params.id);
  const { role } = req.body;
  const validRoles = ["admin", "investisseur", "gestionnaire", "lecteur"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Rôle invalide" });
    return;
  }

  if (targetId === userId && role !== "admin") {
    res.status(400).json({ error: "Vous ne pouvez pas retirer vos propres droits admin" });
    return;
  }

  const rows = await db.update(usersTable).set({ role }).where(eq(usersTable.id, targetId)).returning();
  if (!rows.length) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }

  res.json({ id: rows[0].id, username: rows[0].username, role: rows[0].role, nom: rows[0].nom });
});

router.delete("/users/:id", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const currentUser = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!currentUser[0] || currentUser[0].role !== "admin") {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  const targetId = parseInt(req.params.id);
  if (targetId === userId) {
    res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  res.json({ success: true });
});

export default router;
