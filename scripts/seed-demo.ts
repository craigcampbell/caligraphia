/**
 * Demo seeder: fills Caligraphia with realistic-looking handwritten posts and
 * social activity so the flows can be evaluated with real volume.
 *
 * Unlike seed.ts this does NOT wipe the database — it layers demo users,
 * ~60 rendered letters (uploaded to MinIO through the real pipeline),
 * stamps, scratches, follows, private letters, and exchange activity on top.
 *
 * Usage:
 *   npm run db:seed-demo                  # just the demo world
 *   npm run db:seed-demo -- your_username # also delivers letters + a completed
 *                                         # exchange to that account
 */
import fs from "fs";
import path from "path";

// Load .env before anything touches MinIO config (Prisma loads it itself)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// Deterministic RNG so reruns produce a similar-feeling world
let seed = 20260611;
function rnd(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed & 0x7fffffff) / 0x7fffffff;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function between(a: number, b: number): number {
  return a + rnd() * (b - a);
}

interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
}

const DARK_INKS = ["#1a1a2e", "#2c3e50", "#c0392b", "#2471a3", "#27ae60", "#8e44ad", "#6f4e37"];
const PAPERS = ["blank", "ruled", "ruled", "vellum", "graph", "watercolor"] as const;
const INKS = ["standard", "standard", "quill", "calligraphy", "runny"] as const;

/**
 * Generates asemic handwriting: oscillating "letters" grouped into words and
 * lines, with ascenders, descenders, pen lifts between words, and a looping
 * signature. Reads as handwriting at gallery distance.
 */
function genHandwriting(): StrokePoint[] {
  const pts: StrokePoint[] = [];
  const color = pick(DARK_INKS);
  let t = 1000;

  const lineCount = 3 + Math.floor(rnd() * 9);
  const slant = between(-0.004, 0.004); // baseline drift per line
  let lineY = between(0.09, 0.14);
  const lineHeight = between(0.045, 0.06);
  const letterAmp = between(0.0075, 0.011);

  for (let line = 0; line < lineCount; line++) {
    let x = 0.08 + (line === 0 ? between(0, 0.1) : 0); // slight first-line indent
    const lineEnd = 0.92 - rnd() * 0.12; // ragged right margin
    let baseline = lineY;

    while (x < lineEnd) {
      const wordLetters = 2 + Math.floor(rnd() * 6);
      for (let l = 0; l < wordLetters && x < lineEnd; l++) {
        const tall = rnd() < 0.18 ? 2.6 : 1; // ascender
        const deep = rnd() < 0.12 ? -2.2 : 0; // descender
        const segs = 3 + Math.floor(rnd() * 3);
        for (let s = 0; s < segs; s++) {
          const phase = (s / segs) * Math.PI * 2 + rnd() * 0.8;
          const y =
            baseline -
            Math.abs(Math.sin(phase)) * letterAmp * tall +
            (deep ? Math.max(0, Math.sin(phase + Math.PI)) * letterAmp * -deep : 0) +
            (rnd() - 0.5) * 0.0015;
          pts.push({
            time: t,
            x: Math.min(0.95, x),
            y: Math.max(0.03, Math.min(0.97, y)),
            pressure: Math.max(0.2, Math.min(0.95, 0.55 + Math.sin(t / 900) * 0.2 + (rnd() - 0.5) * 0.2)),
            color,
          });
          t += 14 + rnd() * 12;
          x += between(0.0022, 0.0042);
          baseline += slant * 0.05;
        }
      }
      // pen lift between words
      t += 420 + rnd() * 300;
      x += between(0.01, 0.018);
    }
    lineY += lineHeight;
    t += 600 + rnd() * 500;
    // occasional paragraph gap
    if (rnd() < 0.2) lineY += lineHeight * 0.6;
    if (lineY > 0.82) break;
  }

  // Signature: bigger, loopier, bottom right
  let sx = between(0.5, 0.62);
  const sy = Math.min(0.92, lineY + lineHeight);
  t += 900;
  const loops = 10 + Math.floor(rnd() * 8);
  for (let i = 0; i < loops; i++) {
    const phase = i * 1.4 + rnd();
    pts.push({
      time: t,
      x: sx,
      y: Math.max(0.03, Math.min(0.97, sy - Math.sin(phase) * letterAmp * between(2, 3.6))),
      pressure: Math.max(0.25, Math.min(0.95, 0.6 + (rnd() - 0.5) * 0.3)),
      color,
    });
    t += 16 + rnd() * 10;
    sx += between(0.006, 0.013);
  }

  return pts;
}

/** Doodle posts: spirals, flowers, and little mountain scenes for variety. */
function genDoodle(): StrokePoint[] {
  const pts: StrokePoint[] = [];
  const color = pick(DARK_INKS);
  let t = 1000;
  const kind = Math.floor(rnd() * 3);

  if (kind === 0) {
    // spiral
    const cx = between(0.35, 0.65), cy = between(0.3, 0.5);
    for (let i = 0; i < 260; i++) {
      const a = i * 0.16;
      const r = 0.004 + i * 0.0011;
      pts.push({ time: t, x: cx + Math.cos(a) * r * 0.75, y: cy + Math.sin(a) * r, pressure: 0.45 + Math.sin(i / 12) * 0.2, color });
      t += 15 + rnd() * 8;
    }
  } else if (kind === 1) {
    // flower: petals around a center
    const cx = between(0.4, 0.6), cy = between(0.3, 0.45);
    const petals = 6 + Math.floor(rnd() * 4);
    for (let p = 0; p < petals; p++) {
      const dir = (p / petals) * Math.PI * 2;
      for (let i = 0; i <= 24; i++) {
        const u = (i / 24) * Math.PI;
        const r = Math.sin(u) * 0.1;
        pts.push({
          time: t,
          x: cx + Math.cos(dir) * r * 0.75 - Math.sin(dir) * Math.sin(u * 2) * 0.018,
          y: cy + Math.sin(dir) * r + Math.cos(dir) * Math.sin(u * 2) * 0.018,
          pressure: 0.5 + (rnd() - 0.5) * 0.2,
          color,
        });
        t += 14 + rnd() * 8;
      }
      t += 350;
    }
    // stem
    t += 400;
    for (let i = 0; i <= 30; i++) {
      pts.push({ time: t, x: cx + Math.sin(i / 6) * 0.012, y: cy + 0.1 + (i / 30) * 0.25, pressure: 0.55, color });
      t += 16;
    }
  } else {
    // mountains + sun
    let x = 0.1;
    let y = 0.55;
    while (x < 0.9) {
      const peakW = between(0.08, 0.16);
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        pts.push({ time: t, x: x + u * peakW, y: y - Math.sin(u * Math.PI) * between(0.1, 0.22), pressure: 0.5 + (rnd() - 0.5) * 0.25, color });
        t += 15 + rnd() * 6;
      }
      x += peakW;
    }
    t += 500;
    const sx = between(0.68, 0.8), sy = between(0.18, 0.26);
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push({ time: t, x: sx + Math.cos(a) * 0.045, y: sy + Math.sin(a) * 0.06, pressure: 0.5, color });
      t += 14;
    }
  }
  return pts;
}

const TOPICS: { text: string; tags: string[] }[] = [
  { text: "An evening poem about the rain #poem #poetry", tags: ["#poem", "#poetry"] },
  { text: "Verses for the morning train #verse #poetry", tags: ["#verse", "#poetry"] },
  { text: "Quick sketch from the cafe window #sketch #drawing", tags: ["#sketch", "#drawing"] },
  { text: "Doodled this in a meeting #doodle #sketch", tags: ["#doodle", "#sketch"] },
  { text: "Morning pages, day twelve #journal #daily #morningpages", tags: ["#journal", "#daily", "#morningpages"] },
  { text: "What I remember of grandmother's bread #recipe #family", tags: ["#recipe", "#family"] },
  { text: "A letter I never sent #letter", tags: ["#letter"] },
  { text: "Notes from a night walk #night #thoughts", tags: ["#night", "#thoughts"] },
  { text: "Testing my new fountain pen #fountainpen #ink", tags: ["#fountainpen", "#ink"] },
  { text: "Practice loops and flourishes #calligraphy #practice", tags: ["#calligraphy", "#practice"] },
];

const DEMO_USERS = [
  "margins_and_ink", "the_slow_post", "violet_nib", "paper_pilgrim",
  "left_hand_lena", "broad_nib_bob", "midnight_writer", "dear_stranger",
  "smudged_thumb", "the_archivist", "wandering_pen", "postscript_pearl",
];

async function main() {
  const targetUsername = process.argv[2];
  console.log("Building the demo world...");

  const { renderCanvasToPng } = await import("../src/lib/image");
  const { uploadBuffer } = await import("../src/lib/storage");
  const sharp = (await import("sharp")).default;

  // --- Users ---
  const users = [];
  for (const username of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { username } });
    users.push(
      existing ??
        (await prisma.user.create({
          data: {
            username,
            email: `${username}@demo.caligraphia.invalid`,
            stampBalance: 25,
            createdAt: new Date(Date.now() - between(20, 90) * 86400000),
          },
        }))
    );
  }
  console.log(`Users ready: ${users.length}`);

  // --- Circles ---
  const circles = [
    { name: "Poetry Circle", tagPattern: "#poem #poetry #verse" },
    { name: "Sketches & Doodles", tagPattern: "#sketch #drawing #doodle" },
    { name: "The Daily Page", tagPattern: "#journal #daily #morningpages" },
    { name: "Family Recipes", tagPattern: "#recipe #family" },
    { name: "Pen & Ink Nerds", tagPattern: "#fountainpen #ink #calligraphy" },
  ];
  for (const c of circles) {
    const exists = await prisma.group.findFirst({ where: { name: c.name } });
    if (!exists) {
      await prisma.group.create({
        data: { ...c, creatorId: pick(users).id },
      });
    }
  }
  console.log("Circles ready");

  // --- Public posts (rendered through the real pipeline) ---
  const POST_COUNT = 60;
  const posts = [];
  for (let i = 0; i < POST_COUNT; i++) {
    const isDoodle = rnd() < 0.25;
    const strokes = isDoodle ? genDoodle() : genHandwriting();
    const paper = pick(PAPERS);
    const ink = pick(INKS);
    const topic = pick(TOPICS);
    const author = pick(users);

    const png = await renderCanvasToPng(strokes, paper, ink);
    const compressed = await sharp(png).resize(1200, 1600).png({ quality: 80 }).toBuffer();
    const url = await uploadBuffer(`posts/demo-${uuidv4()}.png`, compressed, "image/png");

    const post = await prisma.post.create({
      data: {
        userId: author.id,
        postType: "canvas",
        canvasStrokeData: strokes as unknown as object,
        paperType: paper,
        inkStyle: ink,
        finalImageUrl: url,
        ocrText: topic.text,
        ocrHashtags: topic.tags,
        createdAt: new Date(Date.now() - between(0, 45) * 86400000),
      },
    });
    posts.push(post);
    if ((i + 1) % 10 === 0) console.log(`  rendered ${i + 1}/${POST_COUNT} letters`);
  }

  // --- Stamps (the one reaction) ---
  let stampTotal = 0;
  for (const post of posts) {
    const stampers = users.filter((u) => u.id !== post.userId && rnd() < 0.3);
    for (const s of stampers.slice(0, 8)) {
      await prisma.postInteraction.create({
        data: { postId: post.id, userId: s.id, interactionType: "like" },
      }).catch(() => {});
    }
    const n = Math.min(stampers.length, 8);
    if (n > 0) await prisma.post.update({ where: { id: post.id }, data: { stampCount: n } });
    stampTotal += n;
  }
  console.log(`Stamped: ${stampTotal} stamps across ${posts.length} posts`);

  // --- Scratches ---
  for (let i = 0; i < 12; i++) {
    const post = pick(posts);
    const scratcher = pick(users.filter((u) => u.id !== post.userId));
    const y = 400 + rnd() * 2400;
    await prisma.scratch.create({
      data: {
        parentPostId: post.id,
        userId: scratcher.id,
        scratchSvgData: `<path d="M${200 + rnd() * 400},${y} q ${300 + rnd() * 400},${(rnd() - 0.5) * 300} ${1200 + rnd() * 600},${(rnd() - 0.5) * 200}" stroke="#c0392b" stroke-width="${6 + rnd() * 8}" fill="none" stroke-linecap="round"/>`,
      },
    });
  }
  console.log("Scratches added: 12");

  // --- Follow graph ---
  let follows = 0;
  for (const a of users) {
    for (const b of users) {
      if (a.id !== b.id && rnd() < 0.18) {
        await prisma.userFollow.create({ data: { followerId: a.id, followingId: b.id } }).catch(() => {});
        follows++;
      }
    }
  }
  console.log(`Follows: ${follows}`);

  // --- Private letters between demo users ---
  for (let i = 0; i < 8; i++) {
    const from = pick(users);
    const to = pick(users.filter((u) => u.id !== from.id));
    const strokes = genHandwriting();
    const png = await renderCanvasToPng(strokes, pick(PAPERS), pick(INKS));
    const compressed = await sharp(png).resize(1200, 1600).png({ quality: 80 }).toBuffer();
    const url = await uploadBuffer(`posts/demo-letter-${uuidv4()}.png`, compressed, "image/png");
    await prisma.post.create({
      data: {
        userId: from.id,
        postType: "canvas",
        canvasStrokeData: strokes as unknown as object,
        paperType: pick(PAPERS),
        inkStyle: pick(INKS),
        finalImageUrl: url,
        recipientId: to.id,
        isPrivate: true,
        ocrText: "a private letter",
        ocrHashtags: [],
        createdAt: new Date(Date.now() - between(0, 20) * 86400000),
      },
    });
  }
  console.log("Private letters: 8");

  // --- An open exchange seat, so the next person to join gets paired instantly ---
  const seatHolder = pick(users);
  const openSeat = await prisma.exchange.findFirst({ where: { userBId: null } });
  if (!openSeat) {
    await prisma.exchange.create({ data: { userAId: seatHolder.id } });
    console.log(`Open exchange seat held by ${seatHolder.username}`);
  }

  // --- Deliver the goods to a real account, if named ---
  if (targetUsername) {
    const target = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!target) {
      console.warn(`! No user named "${targetUsername}" — sign up first, then rerun with your username`);
    } else {
      // five letters in their inbox
      for (let i = 0; i < 5; i++) {
        const from = pick(users);
        const strokes = genHandwriting();
        const png = await renderCanvasToPng(strokes, pick(PAPERS), pick(INKS));
        const compressed = await sharp(png).resize(1200, 1600).png({ quality: 80 }).toBuffer();
        const url = await uploadBuffer(`posts/demo-inbox-${uuidv4()}.png`, compressed, "image/png");
        await prisma.post.create({
          data: {
            userId: from.id,
            postType: "canvas",
            canvasStrokeData: strokes as unknown as object,
            paperType: pick(PAPERS),
            inkStyle: pick(INKS),
            finalImageUrl: url,
            recipientId: target.id,
            isPrivate: true,
            ocrText: "a letter for you",
            ocrHashtags: [],
            createdAt: new Date(Date.now() - between(0, 10) * 86400000),
          },
        });
      }
      console.log(`Delivered 5 letters to ${targetUsername}'s inbox`);
    }
  }

  const totals = await prisma.$transaction([
    prisma.user.count(),
    prisma.post.count(),
    prisma.postInteraction.count(),
  ]);
  console.log(`\nDemo world ready — ${totals[0]} users, ${totals[1]} posts, ${totals[2]} stamps.`);
  console.log("Tip: rerun with your username (npm run db:seed-demo -- your_name) after signing up to fill your inbox.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
