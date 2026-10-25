import { donationUrl } from "@/lib/donation";

export function DonationLink({ className = "" }: { className?: string }) {
  const href = donationUrl();
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`underline-offset-4 hover:underline ${className}`}>
      פרגון לקפה
    </a>
  );
}
