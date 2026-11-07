import type { Member } from "@/lib/db/types";
import { cn } from "./cn";

/** Profilová fotka člena, jinak barevný kruh s iniciálou. */
export function Avatar({ member, size = 32, className }: { member: Pick<Member, "name" | "color" | "avatar_document_id"> | null | undefined; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (member?.avatar_document_id) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${member.avatar_document_id}`} alt={member.name} style={style} className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/15", className)} />;
  }
  return (
    <span style={{ ...style, background: member?.color ?? "#6b665e" }} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[#1b1407]", className)} aria-hidden>
      {(member?.name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
