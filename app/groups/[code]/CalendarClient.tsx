"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getNext7Days, HOURS, slotToISO, formatDayHeader, formatHour } from "@/utils/time";
import { AvatarStack, type ProfileInfo } from "@/components/AvatarStack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  groupId: string;
  inviteCode: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | null;
  memberIds: string[];
  initialAvail: Record<string, string[]>;
  shareUrl: string;
}

export function CalendarClient({
  groupId,
  inviteCode,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  memberIds,
  initialAvail,
  shareUrl,
}: Props) {
  const [avail, setAvail] = useState<Record<string, string[]>>(initialAvail);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({
    [currentUserId]: {
      user_id: currentUserId,
      name: currentUserName,
      avatar_url: currentUserAvatar,
    },
  });
  const [copied, setCopied] = useState(false);

  // Drag state
  const isDragging = useRef(false);
  const dragValue = useRef<boolean>(true); // true = marking free
  const pendingSlots = useRef<Set<string>>(new Set());

  const days = getNext7Days();

  // Load member profiles
  useEffect(() => {
    if (memberIds.length === 0) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("user_id, name, avatar_url")
      .in("user_id", memberIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, ProfileInfo> = {};
        for (const p of data) {
          map[p.user_id] = {
            user_id: p.user_id,
            name: p.name ?? p.user_id.slice(0, 6),
            avatar_url: p.avatar_url ?? null,
          };
        }
        setProfiles((prev) => ({ ...prev, ...map }));
      });
  }, [memberIds]);

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "availability", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const { user_id, slot_start } = payload.new as { user_id: string; slot_start: string };
          setAvail((prev) => {
            const existing = prev[slot_start] ?? [];
            if (existing.includes(user_id)) return prev;
            return { ...prev, [slot_start]: [...existing, user_id] };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "availability", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const { user_id, slot_start } = payload.old as { user_id: string; slot_start: string };
          setAvail((prev) => {
            const existing = prev[slot_start] ?? [];
            return { ...prev, [slot_start]: existing.filter((id) => id !== user_id) };
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  // Global mouse-up to commit drag
  useEffect(() => {
    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      commitDrag();
    }
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, []);

  function commitDrag() {
    const slots = Array.from(pendingSlots.current);
    pendingSlots.current = new Set();
    if (slots.length === 0) return;

    const supabase = createClient();
    if (dragValue.current) {
      const rows = slots.map((slot_start) => ({
        user_id: currentUserId,
        group_id: groupId,
        slot_start,
      }));
      supabase.from("availability").upsert(rows).then(() => {});
    } else {
      supabase
        .from("availability")
        .delete()
        .eq("user_id", currentUserId)
        .eq("group_id", groupId)
        .in("slot_start", slots)
        .then(() => {});
    }
  }

  function applySlot(slot: string) {
    const currentlyFree = (avail[slot] ?? []).includes(currentUserId);
    const shouldBeFree = dragValue.current;

    if (currentlyFree === shouldBeFree) return;
    pendingSlots.current.add(slot);

    setAvail((prev) => {
      const existing = prev[slot] ?? [];
      if (shouldBeFree) {
        if (existing.includes(currentUserId)) return prev;
        return { ...prev, [slot]: [...existing, currentUserId] };
      } else {
        return { ...prev, [slot]: existing.filter((id) => id !== currentUserId) };
      }
    });
  }

  function handleCellMouseDown(slot: string) {
    const currentlyFree = (avail[slot] ?? []).includes(currentUserId);
    dragValue.current = !currentlyFree;
    isDragging.current = true;
    pendingSlots.current = new Set();
    applySlot(slot);
  }

  function handleCellMouseEnter(slot: string) {
    if (!isDragging.current) return;
    applySlot(slot);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const freeUserProfiles = useCallback((slot: string): ProfileInfo[] => {
    const userIds = avail[slot] ?? [];
    return userIds.map((id) => profiles[id] ?? { user_id: id, name: id.slice(0, 6), avatar_url: null });
  }, [avail, profiles]);

  return (
    <div className="flex flex-col gap-4">
      {/* Invite bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-gray-500">Invite link:</span>
          <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate">
            {shareUrl}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">{inviteCode}</Badge>
          <Button size="sm" variant="outline" onClick={copyInvite}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-200 border border-blue-300" />
          <span>You&apos;re free</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-300 border border-green-400" />
          <span>Others free</span>
        </div>
        <span className="text-gray-400">Click or drag to mark yourself free</span>
      </div>

      {/* Calendar grid */}
      <div
        className="overflow-x-auto select-none"
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="min-w-[600px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px mb-1">
            <div />
            {days.map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-600 py-1">
                {formatDayHeader(day)}
              </div>
            ))}
          </div>

          {/* Hour rows */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-gray-200 rounded-lg overflow-hidden">
            {HOURS.map((hour) => (
              <>
                {/* Hour label */}
                <div
                  key={`label-${hour}`}
                  className="bg-gray-50 flex items-center justify-end pr-2 text-[11px] text-gray-400 font-medium"
                  style={{ height: 52 }}
                >
                  {formatHour(hour)}
                </div>

                {/* Day cells for this hour */}
                {days.map((day, di) => {
                  const slot = slotToISO(day, hour);
                  const freeUsers = freeUserProfiles(slot);
                  const count = freeUsers.length;
                  const iAmFree = (avail[slot] ?? []).includes(currentUserId);
                  const othersCount = iAmFree ? count - 1 : count;

                  const bg = iAmFree
                    ? othersCount > 0
                      ? "bg-emerald-200 hover:bg-emerald-300"
                      : "bg-blue-100 hover:bg-blue-200"
                    : othersCount === 0
                      ? "bg-white hover:bg-gray-50"
                      : othersCount === 1
                        ? "bg-green-100 hover:bg-green-200"
                        : othersCount <= 3
                          ? "bg-green-200 hover:bg-green-300"
                          : "bg-green-300 hover:bg-green-400";

                  return (
                    <div
                      key={`${hour}-${di}`}
                      className={`${bg} relative flex flex-col justify-between p-1 cursor-pointer transition-colors`}
                      style={{ height: 52 }}
                      onMouseDown={() => handleCellMouseDown(slot)}
                      onMouseEnter={() => handleCellMouseEnter(slot)}
                    >
                      {count > 0 && (
                        <span className="absolute top-1 right-1 text-[10px] font-bold text-gray-600 leading-none">
                          {count}
                        </span>
                      )}
                      {count > 0 && (
                        <div className="absolute bottom-1 left-1">
                          <AvatarStack
                            users={freeUsers}
                            maxVisible={3}
                            size="xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
