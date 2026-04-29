import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface ProfileInfo {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

interface AvatarStackProps {
  users: ProfileInfo[];
  maxVisible?: number;
  size?: "sm" | "xs";
}

export function AvatarStack({ users, maxVisible = 3, size = "sm" }: AvatarStackProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;
  const dim = size === "xs" ? "h-4 w-4" : "h-5 w-5";

  const names = users.map((u) => u.name).join(", ");

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center -space-x-1 cursor-default">
          {visible.map((u) => (
            <Avatar key={u.user_id} size="sm" className={`${dim} ring-1 ring-white`}>
              {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name} />}
              <AvatarFallback className="bg-blue-500 text-white" style={{ fontSize: 9 }}>
                {initials(u.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 && (
            <span
              className={`inline-flex items-center justify-center ${dim} rounded-full bg-gray-200 text-gray-600 ring-1 ring-white font-medium`}
              style={{ fontSize: 9 }}
            >
              +{overflow}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-xs">{names}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
