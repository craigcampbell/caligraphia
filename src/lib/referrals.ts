import { prisma } from "./prisma";

// When an invited friend writes their FIRST letter, the person who invited them
// earns stamps — closing the referral loop with the existing currency (a real
// reason to bring good people in, no real money involved).
export const REFERRAL_REWARD_STAMPS = 15;

export async function rewardReferralIfFirstPost(userId: string): Promise<void> {
  // Only on the author's first-ever letter.
  const count = await prisma.post.count({ where: { userId, deletedAt: null } });
  if (count !== 1) return;

  const invite = await prisma.invite.findFirst({
    where: { acceptedUserId: userId, status: "accepted", rewardedAt: null },
    select: { id: true, inviterId: true },
  });
  if (!invite || invite.inviterId === userId) return;

  await prisma.$transaction([
    prisma.invite.update({ where: { id: invite.id }, data: { rewardedAt: new Date() } }),
    prisma.user.update({
      where: { id: invite.inviterId },
      data: {
        stampBalance: { increment: REFERRAL_REWARD_STAMPS },
        totalStampsEarned: { increment: REFERRAL_REWARD_STAMPS },
      },
    }),
  ]);
}
