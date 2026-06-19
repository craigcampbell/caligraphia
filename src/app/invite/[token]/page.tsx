import { prisma } from "@/lib/prisma";
import { AcceptButton } from "./AcceptButton";

export const dynamic = "force-dynamic";

export default async function InviteLandingPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { inviter: { select: { username: true } } },
  });

  const inviterName = invite?.inviter.username ?? "Someone";
  const expired =
    !!invite && invite.status === "pending" && invite.expiresAt.getTime() < Date.now();
  const usable = !!invite && invite.status === "pending" && !expired;

  let message: string | null = null;
  if (!invite) message = "This invitation could not be found.";
  else if (invite.status === "accepted")
    message = "This invitation has already been accepted.";
  else if (invite.status === "revoked")
    message = "This invitation is no longer available.";
  else if (expired) message = "This invitation has expired.";

  return (
    <main className="land-main">
      <div className="land-card">
        <div className="land-mark">&#9998; Caligraphia</div>

        {usable ? (
          <>
            <h1 className="land-title">
              {inviterName} sent you a postcard
            </h1>
            <div className="land-postcard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/invites/${token}/image`}
                alt={`A handwritten postcard from ${inviterName}`}
                className="land-img"
              />
            </div>
            <p className="land-sub">
              <strong>{inviterName}</strong> has invited you to Caligraphia — a
              small place where people write to each other by hand. No keyboards,
              no copy-paste, no bots. Accept, pick a pen name, and you&apos;ll be
              friends.
            </p>
            <AcceptButton token={token} />
          </>
        ) : (
          <>
            <h1 className="land-title">A letter that has come and gone</h1>
            <p className="land-sub">{message}</p>
            <a href="/login" className="accept-btn land-link">
              Go to Caligraphia
            </a>
          </>
        )}
      </div>

      <style>{`
        .land-main {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 16px; background: linear-gradient(170deg, #fefcf8 0%, #f5efe0 40%, #faf4ec 100%);
        }
        .land-card {
          background: #fffef9; border: 1px solid #e0d5c0; border-radius: 8px;
          padding: 40px 36px; max-width: 520px; width: 100%; text-align: center;
          box-shadow: 0 4px 32px rgba(80,40,20,0.08);
        }
        .land-mark {
          font-family: Georgia, serif; font-size: 22px; font-weight: 700;
          color: #1a1a1a; margin-bottom: 20px;
        }
        .land-title {
          font-family: Georgia, serif; font-size: 24px; font-weight: 700;
          color: #2c2416; margin-bottom: 20px;
        }
        .land-postcard {
          background: #faf4ec; border: 1px solid #e0d5c0; border-radius: 6px;
          padding: 10px; margin-bottom: 20px; box-shadow: inset 0 1px 3px rgba(80,40,20,0.06);
        }
        .land-img { display: block; width: 100%; border-radius: 4px; }
        .land-sub {
          font-family: Georgia, serif; color: #6b5c40; font-size: 15px;
          line-height: 1.6; margin-bottom: 24px;
        }
        .accept-btn {
          display: inline-block; padding: 14px 32px; background: #1a1a1a; color: #fff;
          border: none; border-radius: 6px; font-size: 16px; font-weight: 700;
          cursor: pointer; font-family: inherit; text-decoration: none;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18); transition: transform 0.15s, box-shadow 0.15s;
        }
        .accept-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
        .accept-btn:disabled { background: #c0b8a8; box-shadow: none; cursor: not-allowed; }
        .land-link { background: #1a1a1a; }
        .accept-err { color: #c0392b; font-size: 14px; margin-bottom: 12px; }
      `}</style>
    </main>
  );
}
