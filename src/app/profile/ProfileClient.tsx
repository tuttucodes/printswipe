"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IndianMobile } from "@/lib/validation";

interface ProfileClientProps {
  initialName: string;
  initialPhone: string;
  initialNotifSms: boolean;
  initialNotifEmail: boolean;
  campusName: string | null;
}

export function ProfileClient({
  initialName,
  initialPhone,
  initialNotifSms,
  initialNotifEmail,
  campusName,
}: ProfileClientProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [notifSms, setNotifSms] = useState(initialNotifSms);
  const [notifEmail, setNotifEmail] = useState(initialNotifEmail);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onSave = () => {
    setError(null);
    setSuccess(false);
    if (phone.trim()) {
      const result = IndianMobile.safeParse(phone.trim());
      if (!result.success) {
        setError(result.error.issues[0]?.message ?? "Invalid phone");
        return;
      }
    }
    startTransition(async () => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setError("Not signed in.");
        return;
      }
      const { error: upErr } = await sb
        .from("profiles")
        .update({
          name: name.trim() || null,
          phone: phone.trim() || null,
          notification_sms: notifSms,
          notification_email: notifEmail,
        })
        .eq("id", user.id);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  };

  const onLogout = () => {
    startTransition(async () => {
      const sb = createClient();
      await sb.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <span className="smallcaps text-ink/60">Account</span>
        </CardHeader>
        <CardBody className="grid gap-4">
          <label className="grid gap-1">
            <span className="smallcaps text-ink/50">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={isPending}
            />
          </label>
          <label className="grid gap-1">
            <span className="smallcaps text-ink/50">Phone (10-digit)</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9XXXXXXXXX"
              inputMode="numeric"
              disabled={isPending}
            />
          </label>
          <div className="hairline-t pt-4">
            <span className="smallcaps text-ink/50">Campus</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-sm">{campusName ?? "Not set"}</span>
              <Link href="/login" className="smallcaps text-ink/60 hover:text-accent">
                Switch
              </Link>
            </div>
          </div>
        </CardBody>
        <CardFooter className="flex items-center justify-between gap-3">
          <div className="text-xs">
            {error && <span className="text-accent font-mono">{error}</span>}
            {success && !error && <span className="text-status-ready font-mono">Saved.</span>}
          </div>
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <span className="smallcaps text-ink/60">Notifications</span>
        </CardHeader>
        <CardBody className="grid gap-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">SMS reminders</span>
            <input
              type="checkbox"
              checked={notifSms}
              onChange={(e) => setNotifSms(e.target.checked)}
              className="h-5 w-5 accent-accent"
              disabled={isPending}
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">Email receipts</span>
            <input
              type="checkbox"
              checked={notifEmail}
              onChange={(e) => setNotifEmail(e.target.checked)}
              className="h-5 w-5 accent-accent"
              disabled={isPending}
            />
          </label>
        </CardBody>
      </Card>

      <Button variant="secondary" onClick={onLogout} disabled={isPending} className="self-start">
        Logout
      </Button>
    </div>
  );
}
