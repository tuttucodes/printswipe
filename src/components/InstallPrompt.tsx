"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

const KEY = "ps_install_dismissed_at";
const COOLDOWN_DAYS = 7;

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) ?? 0);
    const now = Date.now();
    if (now - last < COOLDOWN_DAYS * 86_400_000) return;
    const visit = Number(localStorage.getItem("ps_visits") ?? 0) + 1;
    localStorage.setItem("ps_visits", String(visit));
    if (visit < 2) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.matchMedia("(display-mode: standalone)").matches) || (window.navigator as any).standalone;
    if (isIos && !isStandalone) {
      setIosHint(true);
      setShow(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    localStorage.setItem(KEY, String(Date.now()));
  }
  async function install() {
    if (!evt) return dismiss();
    await evt.prompt();
    await evt.userChoice;
    dismiss();
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40 hairline bg-paper p-4 animate-fade-up">
      <div className="smallcaps text-ink/60 mb-2">Install Printswipe</div>
      {iosHint ? (
        <p className="text-sm">Tap the Share button, then "Add to Home Screen" to install Printswipe.</p>
      ) : (
        <p className="text-sm">Add to home screen for offline access and faster opens.</p>
      )}
      <div className="flex gap-2 mt-3">
        {!iosHint && <Button onClick={install}>Install</Button>}
        <Button variant="secondary" onClick={dismiss}>Not now</Button>
      </div>
    </div>
  );
}
