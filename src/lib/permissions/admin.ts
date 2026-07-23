import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions/firm-context";

export type AdminContext = {
  email: string;
  userId: string;
};

export async function requireAdmin(): Promise<AdminContext> {
  const { email, userId } = await requireUser();
  const admin = await prisma.user.findFirst({
    where: {
      id: userId,
      role: UserRole.ADMIN,
    },
    select: { id: true },
  });

  if (!admin) {
    notFound();
  }

  return { email, userId };
}

export async function isAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === UserRole.ADMIN;
}
