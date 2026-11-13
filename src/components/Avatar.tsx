import { initials } from "@/data/speakers";

export function Avatar({ name, hue, size = 48 }: { name: string; hue: number; size?: number }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        ["--h" as string]: hue,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

// Stable colour per person, from their pass code.
export function avatarHue(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
