"use client";

// Where this phone is, for location-locked check-in (poster scans) and for crew pinning an event's place.
export type Spot = { lat: number; lng: number; acc: number };

// A rough fix is one that could be this far (metres) from where you really are: shown as "about" with its range.
export const ROUGH_M = 300;

// For "how far is it": phones and especially PCs (Wi-Fi / IP location, no GPS) often give a rough first fix and a
// better one seconds later. Listen up to `windowMs` and keep the most accurate; stop early once it's within `good` m.
export function bestSpot(windowMs = 8_000, good = 50): Promise<Spot> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This device can't share its location."));
      return;
    }
    let best: Spot | null = null;
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(err ?? new Error("Couldn't find your location. Try again."));
    };
    const take = (p: GeolocationPosition) => {
      const s = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
      if (!best || s.acc < best.acc) best = s;
      if (s.acc <= good) finish();
    };
    const fail = (e: GeolocationPositionError) => {
      if (e.code === 1) finish(new Error("Allow location for this app to see how far it is."));
      // other errors: keep waiting for the other request; the timer ends it
    };
    const opts = { enableHighAccuracy: true, timeout: windowMs + 4_000 };
    // a quick first fix (some browsers never fire the watch), then the watch refines it
    navigator.geolocation.getCurrentPosition(take, fail, { ...opts, maximumAge: 30_000 });
    const watch = navigator.geolocation.watchPosition(take, fail, { ...opts, maximumAge: 0 });
    const timer = setTimeout(() => finish(new Error("Couldn't find your location. Step near a window and try again.")), windowMs);
  });
}

export function getSpot(timeout = 12_000): Promise<Spot> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This phone can't share its location. Ask a volunteer."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      (e) =>
        reject(new Error(e.code === 1
          ? "Allow location for this app to check in. It confirms you're at the event."
          : "Couldn't find your location. Step near a window and try again.")),
      { enableHighAccuracy: true, timeout, maximumAge: 30_000 },
    );
  });
}
