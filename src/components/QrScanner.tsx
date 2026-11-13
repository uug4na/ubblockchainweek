"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { haptic } from "@/lib/haptics";

type Props = {
  onResult: (text: string) => void;
  busy?: boolean; // stop reading while the last scan is being handled
  manualLabel?: string;
  manualPlaceholder?: string;
  typing?: boolean; // show the type-the-code fallback (off where codes can't be typed, like live connect codes)
};

// Rear camera + jsQR, with a type-the-code fallback for when there's no camera
// (or the page isn't on HTTPS, which phones require for camera access).
export function QrScanner({ onResult, busy, manualLabel = "Or type the code", manualPlaceholder = "UB-XXXXXX", typing = true }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef({ text: "", at: 0 });
  const busyRef = useRef(busy);
  const cb = useRef(onResult);
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    busyRef.current = busy;
    cb.current = onResult;
  });

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | undefined;
    let raf = 0;
    let lastTick = 0;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = (t: number) => {
          raf = requestAnimationFrame(tick);
          if (t - lastTick < 120 || busyRef.current || v.readyState < 2) return;
          lastTick = t;
          const c = canvas.current!;
          const scale = Math.min(1, 640 / v.videoWidth);
          c.width = Math.round(v.videoWidth * scale);
          c.height = Math.round(v.videoHeight * scale);
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const hit = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: "dontInvert" });
          if (!hit?.data) return;
          const now = Date.now();
          // The same code held in front of the camera shouldn't fire twice.
          if (hit.data === last.current.text && now - last.current.at < 4000) return;
          last.current = { text: hit.data, at: now };
          haptic.scan();
          cb.current(hit.data);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setOn(false);
        setError(
          !window.isSecureContext
            ? "The camera only works over HTTPS (or on localhost). Type the code below instead."
            : (e as Error).name === "NotAllowedError"
              ? "Camera permission was blocked. Allow it in your browser settings, or type the code below."
              : "Couldn't open a camera on this device. Type the code below instead.",
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);

  return (
    <div className="scanner">
      <div className={`scan-view ${on ? "is-on" : ""}`}>
        <video ref={video} muted playsInline aria-hidden />
        <canvas ref={canvas} hidden />
        {on ? (
          <>
            <div className="scan-frame" aria-hidden><i /><i /><i /><i /></div>
            <button className="scan-toggle" onClick={() => setOn(false)} aria-label="Turn camera off"><CameraOff size={18} /></button>
          </>
        ) : (
          <div className="scan-idle">
            <Camera size={34} />
            <button className="btn btn-clay" onClick={() => { setError(""); setOn(true); }}>Start camera</button>
            {error && <p className="scan-error">{error}</p>}
          </div>
        )}
      </div>
      {typing && <form
        className="scan-manual"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) cb.current(manual.trim());
          setManual("");
        }}
      >
        <label htmlFor="manual-code"><Keyboard size={15} /> {manualLabel}</label>
        <div>
          <input id="manual-code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={manualPlaceholder} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          <button className="btn btn-primary" type="submit" disabled={busy}>Go</button>
        </div>
      </form>}
    </div>
  );
}
