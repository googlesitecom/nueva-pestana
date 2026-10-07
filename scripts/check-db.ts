import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({ select: { id: true, username: true, displayName: true } });
  console.log("Usuarios:", JSON.stringify(users, null, 2));
  const friendships = await db.friendship.findMany();
  console.log("Amistades:", JSON.stringify(friendships, null, 2));
  const sessions = await db.session.findMany();
  console.log("Sesiones activas:", sessions.length);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
