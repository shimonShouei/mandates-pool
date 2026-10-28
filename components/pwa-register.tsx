"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) return null;

  return (
    <div className="mt-8 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
      <p className="font-medium">אפשר להוסיף למסך הבית</p>
      <p className="mt-1 text-muted-foreground">
        {ios
          ? "בספארי: שיתוף, ואז «הוספה למסך הבית». זה אתר, לא אפליקציה מחנות."
          : "מהתפריט של הדפדפן בחרו «הוספה למסך הבית» או «התקנת אפליקציה»."}
      </p>
      {prompt ? (
        <Button
          type="button"
          className="mt-3 h-11"
          onClick={() => {
            void prompt.prompt();
          }}
        >
          הוספה למסך הבית
        </Button>
      ) : null}
    </div>
  );
}
