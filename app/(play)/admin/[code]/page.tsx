import { redirect } from "next/navigation";

export default async function LegacyAdminGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/g/${code}/manage`);
}
