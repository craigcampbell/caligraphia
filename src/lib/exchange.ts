import { prisma } from "./prisma";

export interface ExchangeStatus {
  state: "none" | "waiting" | "write" | "sent" | "complete";
  exchangeId?: string;
  partner?: { id: string; username: string; nomDePlume: string | null };
  receivedLetterId?: string | null;
}

/** The user's most recent exchange that still has something happening in it. */
export async function getActiveExchange(userId: string) {
  return prisma.exchange.findFirst({
    where: {
      OR: [
        { userAId: userId, userBId: null },
        { userAId: userId, letterAId: null },
        { userBId: userId, letterBId: null },
        { userAId: userId, letterBId: null },
        { userBId: userId, letterAId: null },
      ],
    },
    include: {
      userA: { select: { id: true, username: true, nomDePlume: true } },
      userB: { select: { id: true, username: true, nomDePlume: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function describeExchange(
  userId: string,
  exchange: NonNullable<Awaited<ReturnType<typeof getActiveExchange>>> | null
): ExchangeStatus {
  if (!exchange) return { state: "none" };
  if (!exchange.userBId) return { state: "waiting", exchangeId: exchange.id };

  const isA = exchange.userAId === userId;
  const partner = isA ? exchange.userB! : exchange.userA;
  const myLetter = isA ? exchange.letterAId : exchange.letterBId;
  const theirLetter = isA ? exchange.letterBId : exchange.letterAId;

  let state: ExchangeStatus["state"];
  if (!myLetter) state = "write";
  else if (!theirLetter) state = "sent";
  else state = "complete";

  return {
    state,
    exchangeId: exchange.id,
    partner,
    receivedLetterId: theirLetter,
  };
}

/**
 * If the author owes their exchange partner a letter and just sent them one,
 * record it against the exchange. No-op otherwise.
 */
export async function attachLetterToExchange(
  authorId: string,
  recipientId: string,
  postId: string
): Promise<void> {
  const exchange = await prisma.exchange.findFirst({
    where: {
      OR: [
        { userAId: authorId, userBId: recipientId, letterAId: null },
        { userAId: recipientId, userBId: authorId, letterBId: null },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!exchange) return;

  await prisma.exchange.update({
    where: { id: exchange.id },
    data:
      exchange.userAId === authorId
        ? { letterAId: postId }
        : { letterBId: postId },
  });
}
