"use client";

// Little physical cues so people can feel what happened without looking.
//   scan    — one tiny tick the moment a QR is read
//   scratch — a 5 ms grain while a finger scratches a ticket (Android only)
//   reward  — "ta-da": stars landed (poster, reward QR, social task)
//   success — two quick taps: a crew action went through, a swap is reserved
//   error   — two longer buzzes: didn't work
// Android/Chrome use the Vibration API. iPhones don't support it in any browser; on iOS 18+
// toggling a hidden "switch" checkbox produces a system haptic tap, which we use as a stand-in.

type Pattern = number | number[];

const patterns = {
  scan: 12,
  scratch: 5,
  reward: [40, 70, 40, 70, 140],
  success: [25, 60, 25],
  error: [90, 70, 90],
} satisfies Record<string, Pattern>;

// How many iOS taps roughly match each pattern.
const iosTaps: Record<keyof typeof patterns, number[]> = {
  scan: [0],
  scratch: [],
  reward: [0, 110, 220],
  success: [0, 90],
  error: [0, 160],
};

let iosSwitch: HTMLLabelElement | null = null;
function iosTap() {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

function play(kind: keyof typeof patterns) {
  if (typeof window === "undefined") return;
  // Browsers block vibration until the first tap (e.g. a quiz popping up on load) and log an error.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(patterns[kind]);
      return;
    }
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)) {
      for (const at of iosTaps[kind]) setTimeout(iosTap, at);
    }
  } catch {
    // Haptics are a nicety — never let them break a scan.
  }
}

export const haptic = {
  scan: () => play("scan"),
  scratch: () => play("scratch"),
  reward: () => play("reward"),
  success: () => play("success"),
  error: () => play("error"),
};
