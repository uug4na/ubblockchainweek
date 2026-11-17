"use client";

// Where this phone is, for location-locked check-in (poster scans) and for crew pinning an event's place.
export type Spot = { lat: number; lng: number; acc: number };

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
