import type { CSSProperties } from "react";
import { avatarPalette } from "../lib/avatars";

interface AvatarProps {
  name: string;
  avatar: number;
  size?: number;
  className?: string;
}

export function Avatar({ name, avatar, size = 34, className }: AvatarProps) {
  const [bg, ink] = avatarPalette[avatar % avatarPalette.length];
  const style = { "--avatar-bg": bg, "--avatar-ink": ink, width: size, height: size, fontSize: size * 0.36 } as CSSProperties;
  return (
    <span className={`avatar${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
