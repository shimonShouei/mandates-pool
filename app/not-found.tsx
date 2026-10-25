import Link from "next/link";
import { Shell } from "@/components/shell";

export default function NotFound() {
  return (
    <Shell>
      <h1 className="mt-10 font-heading text-4xl">העמוד לא נמצא</h1>
      <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
        חזרה למנדטים
      </Link>
    </Shell>
  );
}
