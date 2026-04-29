"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinGroupDialog({ defaultCode }: { defaultCode?: string }) {
  const [open, setOpen] = useState(!!defaultCode);
  const [code, setCode] = useState(defaultCode ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    router.push(`/join/${trimmed}`);
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Join with code</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a group</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                placeholder="e.g. XK4P9T"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                maxLength={6}
                className="font-mono tracking-widest"
                autoFocus
              />
            </div>
            <Button onClick={handleJoin} disabled={code.trim().length < 4 || loading}>
              {loading ? "Joining…" : "Join group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
