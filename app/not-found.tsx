import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";

export default function NotFound() {
  return (
    <SiteFrame signedIn={false}>
      <h1 className="mt-10 font-heading text-4xl">העמוד לא נמצא</h1>
      <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
        חזרה למנדטים
      </Link>
    </SiteFrame>
  );
}
