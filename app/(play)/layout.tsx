import { ClaimDevice } from "@/components/claim-device";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClaimDevice />
      {children}
    </>
  );
}
