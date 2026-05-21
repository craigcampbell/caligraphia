import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const prisma = new PrismaClient();

function fakeImageUrl(): string {
  const colors = ["f0f0f0", "e8e8e8", "ddd", "ccc", "bbb"];
  const bg = colors[Math.floor(Math.random() * colors.length)];
  return `https://placehold.co/600x400/${bg}/333?text=handwritten`;
}

async function main() {
  console.log("Seeding database...");

  await prisma.flag.deleteMany();
  await prisma.scratch.deleteMany();
  await prisma.postInteraction.deleteMany();
  await prisma.userFollow.deleteMany();
  await prisma.post.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  const users = await Promise.all([
    prisma.user.create({
      data: { username: "ink_sage", email: "ink_sage@example.com", nomDePlume: fakeImageUrl() },
    }),
    prisma.user.create({
      data: { username: "quill_master", email: "quill_master@example.com", nomDePlume: fakeImageUrl() },
    }),
    prisma.user.create({
      data: { username: "pen_wielder", email: "pen_wielder@example.com", nomDePlume: fakeImageUrl() },
    }),
    prisma.user.create({
      data: { username: "brush_stroke", email: "brush_stroke@example.com", nomDePlume: fakeImageUrl() },
    }),
    prisma.user.create({
      data: { username: "script_nomad", email: "script_nomad@example.com", nomDePlume: fakeImageUrl() },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  await prisma.userFollow.create({
    data: { followerId: users[0].id, followingId: users[1].id },
  });
  await prisma.userFollow.create({
    data: { followerId: users[0].id, followingId: users[2].id },
  });
  await prisma.userFollow.create({
    data: { followerId: users[1].id, followingId: users[0].id },
  });

  const samplePosts = [
    {
      userId: users[0].id,
      postType: "canvas" as const,
      canvasStrokeData: [
        { time: 1000, x: 0.1, y: 0.5, pressure: 0.6, color: "#000000" },
        { time: 1200, x: 0.3, y: 0.45, pressure: 0.7, color: "#000000" },
        { time: 1400, x: 0.5, y: 0.5, pressure: 0.8, color: "#3182ce" },
        { time: 1600, x: 0.7, y: 0.45, pressure: 0.7, color: "#3182ce" },
        { time: 18000, x: 0.9, y: 0.5, pressure: 0.6, color: "#000000" },
      ],
      finalImageUrl: fakeImageUrl(),
      ocrText: "Hello world",
      ocrHashtags: ["#poetry", "#hello"],
    },
    {
      userId: users[1].id,
      postType: "canvas" as const,
      canvasStrokeData: [
        { time: 1000, x: 0.2, y: 0.4, pressure: 0.5, color: "#000000" },
        { time: 1200, x: 0.4, y: 0.35, pressure: 0.6, color: "#000000" },
        { time: 1400, x: 0.6, y: 0.4, pressure: 0.7, color: "#e53e3e" },
        { time: 1600, x: 0.8, y: 0.35, pressure: 0.5, color: "#e53e3e" },
        { time: 17000, x: 0.9, y: 0.4, pressure: 0.6, color: "#000000" },
      ],
      finalImageUrl: fakeImageUrl(),
      ocrText: "A sketch of a tree #sketch",
      ocrHashtags: ["#sketch", "#drawing"],
    },
    {
      userId: users[2].id,
      postType: "photo" as const,
      uploadedPhotoUrl: fakeImageUrl(),
      ocrText: "To whom it may concern #letter",
      ocrHashtags: ["#letter"],
    },
    {
      userId: users[3].id,
      postType: "canvas" as const,
      canvasStrokeData: [
        { time: 1000, x: 0.15, y: 0.5, pressure: 0.4, color: "#805ad5" },
        { time: 1200, x: 0.3, y: 0.48, pressure: 0.6, color: "#805ad5" },
        { time: 16000, x: 0.7, y: 0.5, pressure: 0.5, color: "#805ad5" },
      ],
      finalImageUrl: fakeImageUrl(),
      ocrText: "The stars are silent #quote",
      ocrHashtags: ["#quote", "#poetry"],
    },
    {
      userId: users[4].id,
      postType: "canvas" as const,
      canvasStrokeData: [
        { time: 1000, x: 0.1, y: 0.4, pressure: 0.5, color: "#38a169" },
        { time: 1500, x: 0.25, y: 0.38, pressure: 0.6, color: "#38a169" },
        { time: 20000, x: 0.85, y: 0.4, pressure: 0.7, color: "#38a169" },
      ],
      finalImageUrl: fakeImageUrl(),
      ocrText: "Wandering thoughts #note",
      ocrHashtags: ["#note", "#sketch"],
    },
    {
      userId: users[0].id,
      postType: "canvas" as const,
      canvasStrokeData: [
        { time: 1000, x: 0.12, y: 0.5, pressure: 0.5, color: "#000000" },
        { time: 1500, x: 0.4, y: 0.48, pressure: 0.7, color: "#e53e3e" },
        { time: 18000, x: 0.88, y: 0.5, pressure: 0.6, color: "#e53e3e" },
      ],
      finalImageUrl: fakeImageUrl(),
      ocrText: "Another poem for the evening #poem",
      ocrHashtags: ["#poem", "#poetry", "#verse"],
    },
  ];

  const posts = await Promise.all(
    samplePosts.map((p) => prisma.post.create({ data: p }))
  );

  console.log(`Created ${posts.length} posts`);

  await prisma.postInteraction.create({
    data: {
      postId: posts[0].id,
      userId: users[1].id,
      interactionType: "like",
    },
  });
  await prisma.postInteraction.create({
    data: {
      postId: posts[0].id,
      userId: users[2].id,
      interactionType: "like",
    },
  });
  await prisma.postInteraction.create({
    data: {
      postId: posts[1].id,
      userId: users[0].id,
      interactionType: "like",
    },
  });
  await prisma.postInteraction.create({
    data: {
      postId: posts[2].id,
      userId: users[3].id,
      interactionType: "dislike",
    },
  });

  await prisma.scratch.create({
    data: {
      parentPostId: posts[0].id,
      userId: users[3].id,
      scratchSvgData: `<path d="M100,200 L300,250 L500,200" stroke="#e53e3e" stroke-width="3" fill="none"/>`,
    },
  });

  await prisma.group.create({
    data: {
      name: "Poetry Circle",
      creatorId: users[0].id,
      tagPattern: "#poem|#poetry|#verse",
    },
  });
  await prisma.group.create({
    data: {
      name: "Sketches & Doodles",
      creatorId: users[1].id,
      tagPattern: "#sketch|#drawing|#doodle",
    },
  });

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
