// The chat send launch (shared by 1:1 chats and the UB Hack group). Styles: .chat-send-fx in globals.css.
import { ArrowUp } from "lucide-react";

/** The launch: the arrow rockets up out of the button with a fading trail, two shock rings
 *  spread, and brand pixel blocks scatter outward and drift down as they fade. */
const PIXELS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * 360 + (i % 2 ? 9 : -9);
  return { a, d: 26 + ((i * 7) % 4) * 6, s: 3 + (i % 3), r: (i % 2 ? 1 : -1) * (90 + i * 20), delay: (i % 4) * 18 };
});
export function SendBurst() {
  return (
    <span className="chat-send-fx" aria-hidden>
      <span className="chat-send-ring" />
      <span className="chat-send-ring is-2" />
      {[3, 2, 1].map((n) => (
        <span key={n} className={`chat-send-trail t${n}`}><ArrowUp size={18} strokeWidth={2.5} /></span>
      ))}
      <span className="chat-send-rocket"><ArrowUp size={18} strokeWidth={2.5} /></span>
      {PIXELS.map((p, i) => (
        <i
          key={i}
          style={{ ["--a" as string]: `${p.a}deg`, ["--d" as string]: `${p.d}px`, ["--s" as string]: `${p.s}px`, ["--r" as string]: `${p.r}deg`, animationDelay: `${120 + p.delay}ms` }}
        />
      ))}
    </span>
  );
}

