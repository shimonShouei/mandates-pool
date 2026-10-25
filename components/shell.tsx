import { currentUser } from "@/auth";
import { SiteFrame } from "@/components/site-frame";

export async function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const user = await currentUser();
  return (
    <SiteFrame signedIn={Boolean(user)} wide={wide}>
      {children}
    </SiteFrame>
  );
}
