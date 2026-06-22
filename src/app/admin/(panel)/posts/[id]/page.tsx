import PostModeration from "@/components/admin/PostModeration";

export const dynamic = "force-dynamic";

export default async function PostModerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostModeration postId={id} />;
}
