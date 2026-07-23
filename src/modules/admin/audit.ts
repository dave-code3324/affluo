import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

type AuditInput = {
  action: string;
  actorUserId: string;
  entityId: string;
  entityType: string;
  metadata?: Prisma.InputJsonObject;
  newData?: Prisma.InputJsonObject;
  previousData?: Prisma.InputJsonObject;
};

export function writeAuditLog(
  database: DatabaseClient,
  {
    action,
    actorUserId,
    entityId,
    entityType,
    metadata,
    newData,
    previousData,
  }: AuditInput,
) {
  return database.auditLog.create({
    data: {
      action,
      actorUserId,
      entityId,
      entityType,
      metadata,
      newData,
      previousData,
    },
  });
}
