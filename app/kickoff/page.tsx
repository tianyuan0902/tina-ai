import { KickoffChat } from "@/components/tina/kickoff-chat";

export default async function KickoffPage({
  searchParams
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const params = await searchParams;

  return <KickoffChat initialNeed={params.need?.trim()} />;
}
