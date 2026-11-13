"use client";

// Four shagai (sheep ankle bones), drawn with three.js. The bone is "Knucklebone Dice" by MishaT
// (thingiverse.com/thing:1036458, CC BY-NC), prepared by scripts/shagai-model.mjs into
// public/models/shagai-bone.stl with x = length, y = through the wide sides, z = through the
// narrow ones. Sides: sheep = the convex "belly" (+y), goat = the concave "back" (-y),
// camel = the twisted side (+z), horse = the flat side (-z).
// throwBones() shuffles them low over the table until the server's throw is known, then throws
// them with real rigid-body physics (cannon-es): each bone's throw is simulated off-screen,
// re-rolled until it settles on the side the server chose, and that recording is played back.

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import { withBase } from "@/lib/base";
import * as CANNON from "cannon-es";
import type { Bone } from "@/data/shagai";

export type ShagaiHandle = {
  /** Throw; resolves once all four have landed on `result` (bone i lands in slot i, left to right). */
  throwBones: (result: Promise<Bone[]>, opts?: { calm?: boolean; onTouch?: (i: number) => void }) => Promise<Bone[]>;
  anchor: () => HTMLElement | null;
};

const SLOTS = [-2.2, -0.73, 0.73, 2.2];

// Which way up each side is. Starts as the plain axis turns; once the model loads, each becomes
// the pose the bone really settles in with that side up (see restPoses).
const AXIS_DOWN: Record<Bone, THREE.Vector3> = {
  sheep: new THREE.Vector3(0, -1, 0), goat: new THREE.Vector3(0, 1, 0), camel: new THREE.Vector3(0, 0, -1), horse: new THREE.Vector3(0, 0, 1),
};
const X = new THREE.Vector3(1, 0, 0);
const FACE: Record<Bone, THREE.Quaternion> = {
  sheep: new THREE.Quaternion(),
  goat: new THREE.Quaternion().setFromAxisAngle(X, Math.PI),
  camel: new THREE.Quaternion().setFromAxisAngle(X, -Math.PI / 2),
  horse: new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2),
};
const BONES_ALL: Bone[] = ["sheep", "goat", "horse", "camel"];

// Load the bone, smooth its shading, and colour it like old bone: honey ivory, browner down in
// the creases (where the surface curves in), with a worn stain toward one end.
async function loadBone() {
  const res = await fetch(withBase("/models/shagai-bone.stl"));
  if (!res.ok) throw new Error("bone model missing");
  let geo = new STLLoader().parse(await res.arrayBuffer());
  geo.deleteAttribute("normal");
  geo = mergeVertices(geo, 1e-4);
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute, nor = geo.attributes.normal as THREE.BufferAttribute;
  const idx = geo.index!;
  const n = pos.count, sum = new Float32Array(n * 3), cnt = new Uint16Array(n);
  for (let t = 0; t < idx.count; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = idx.getX(t + k);
      for (const j of [1, 2]) {
        const b = idx.getX(t + ((k + j) % 3));
        sum[a * 3] += pos.getX(b); sum[a * 3 + 1] += pos.getY(b); sum[a * 3 + 2] += pos.getZ(b); cnt[a]++;
      }
    }
  const col = new Float32Array(n * 3), c = new THREE.Color();
  const PALE = new THREE.Color("#efdcae"), HONEY = new THREE.Color("#d4a861"), DEEP = new THREE.Color("#7c5426"), STAIN = new THREE.Color("#4e3520");
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // crease: how far the neighbours sit "above" this vertex along its normal
    const ax = sum[i * 3] / cnt[i] - x, ay = sum[i * 3 + 1] / cnt[i] - y, az = sum[i * 3 + 2] / cnt[i] - z;
    const crease = (ax * nor.getX(i) + ay * nor.getY(i) + az * nor.getZ(i)) * 60;
    c.copy(HONEY).lerp(PALE, THREE.MathUtils.clamp(-crease, 0, 1) * 0.8).lerp(DEEP, THREE.MathUtils.clamp(crease, 0, 1) * 0.75);
    c.lerp(STAIN, THREE.MathUtils.smoothstep(x, 0.45, 0.75) * (0.5 + 0.5 * Math.sin(y * 9 + z * 7)) * 0.4);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.scale(0.86, 0.86, 0.86); // a touch smaller, so four fit the hand and the table without touching
  return geo;
}

// For each side: the hull facet the bone's centre sits over when that side is up, turned flat
// onto the table, so the bone rests the way a real one would, not balanced on an axis.
function restPoses(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute, pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  const hull = new ConvexHull().setFromPoints(pts);
  const out = {} as Record<Bone, { q: THREE.Quaternion; h: number }>;
  const down = new THREE.Vector3(0, -1, 0);
  for (const bone of BONES_ALL) {
    const dir = AXIS_DOWN[bone];
    let best: THREE.Vector3 | null = null, bestT = Infinity;
    for (const f of hull.faces) {
      const a = f.edge.head().point, b = f.edge.next.head().point, c = f.edge.next.next.head().point;
      const dn = f.normal.dot(dir);
      if (dn <= 0.2) continue;
      const t = f.normal.dot(a) / dn; // the ray from the centre along `dir` meets this facet's plane
      if (t <= 0 || t >= bestT) continue;
      const p = dir.clone().multiplyScalar(t);
      const inside = ([[a, b], [b, c], [c, a]] as const).every(([u, v]) =>
        new THREE.Vector3().subVectors(v, u).cross(new THREE.Vector3().subVectors(p, u)).dot(f.normal) >= -1e-6);
      if (inside) { bestT = t; best = f.normal.clone(); }
    }
    const q = best ? new THREE.Quaternion().setFromUnitVectors(best, down) : FACE[bone].clone();
    let low = Infinity;
    const v = new THREE.Vector3();
    for (const p of pts) low = Math.min(low, v.copy(p).applyQuaternion(q).y);
    out[bone] = { q, h: -low };
  }
  return out;
}

// The side facing up, from a bone's orientation: whichever of its four side axes points highest.
const SIDE_AXES: [Bone, THREE.Vector3][] = [
  ["sheep", new THREE.Vector3(0, 1, 0)], ["goat", new THREE.Vector3(0, -1, 0)],
  ["camel", new THREE.Vector3(0, 0, 1)], ["horse", new THREE.Vector3(0, 0, -1)],
];
function sideUp(q: THREE.Quaternion): Bone {
  let best: Bone = "sheep", top = -Infinity;
  const v = new THREE.Vector3();
  for (const [b, ax] of SIDE_AXES) { const y = v.copy(ax).applyQuaternion(q).y; if (y > top) { top = y; best = b; } }
  return best;
}

// The bone's convex hull as a cannon-es collision shape.
function hullShape(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute, pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  const hull = new ConvexHull().setFromPoints(pts);
  const ids = new Map<THREE.Vector3, number>(), verts: CANNON.Vec3[] = [], faces: number[][] = [];
  const id = (p: THREE.Vector3) => { let k = ids.get(p); if (k === undefined) { k = verts.length; ids.set(p, k); verts.push(new CANNON.Vec3(p.x, p.y, p.z)); } return k; };
  for (const f of hull.faces) faces.push([id(f.edge.head().point), id(f.edge.next.head().point), id(f.edge.next.next.head().point)]);
  return new CANNON.ConvexPolyhedron({ vertices: verts, faces });
}

// One recorded throw: positions and orientations at 60 fps, and the frame it first hits the table.
type Track = { pos: Float32Array; quat: Float32Array; n: number; hit: number };
const SIM_HZ = 120, REC_EVERY = 2, MAX_S = 2.6;

function simulate(shape: CANNON.ConvexPolyhedron, from: { pos: THREE.Vector3; q: THREE.Quaternion }, aim: THREE.Vector3, calm: boolean) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -38, 0), allowSleep: true });
  world.defaultContactMaterial.friction = 0.45;
  world.defaultContactMaterial.restitution = 0.3;
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);
  const body = new CANNON.Body({
    mass: 1, shape, linearDamping: 0.08, angularDamping: 0.45, allowSleep: true, sleepSpeedLimit: 0.4, sleepTimeLimit: 0.15,
    position: new CANNON.Vec3(from.pos.x, from.pos.y, from.pos.z), quaternion: new CANNON.Quaternion(from.q.x, from.q.y, from.q.z, from.q.w),
  });
  // a toss toward the aim point, up and out, spinning about a random axis
  const T = calm ? 0.42 : 0.55;
  body.velocity.set(((aim.x - from.pos.x) / T) * 0.75, calm ? 2.5 : 5 + Math.random() * 2.5, ((aim.z - from.pos.z) / T) * 0.75);
  const ax = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(calm ? 6 : 11 + Math.random() * 9);
  body.angularVelocity.set(ax.x, ax.y, ax.z);
  let hit = -1;
  body.addEventListener("collide", () => { if (hit < 0) hit = Math.floor(steps / REC_EVERY); });
  world.addBody(body);
  const max = Math.ceil((MAX_S * SIM_HZ) / REC_EVERY);
  const pos = new Float32Array(max * 3), quat = new Float32Array(max * 4);
  let n = 0, steps = 0;
  while (n < max) {
    if (steps % REC_EVERY === 0) {
      pos.set([body.position.x, body.position.y, body.position.z], n * 3);
      quat.set([body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w], n * 4);
      n++;
      if (body.sleepState === CANNON.Body.SLEEPING) break;
    }
    world.step(1 / SIM_HZ);
    steps++;
  }
  const end = new THREE.Quaternion(quat[(n - 1) * 4], quat[(n - 1) * 4 + 1], quat[(n - 1) * 4 + 2], quat[(n - 1) * 4 + 3]);
  const h = hit < 0 ? n - 1 : hit;
  // how far it skids and rolls after first touching the table
  let roll = 0;
  for (let f = h; f < n; f++) roll = Math.max(roll, Math.hypot(pos[f * 3] - pos[(n - 1) * 3], pos[f * 3 + 2] - pos[(n - 1) * 3 + 2]));
  return { track: { pos, quat, n, hit: h } as Track, side: sideUp(end), roll };
}

// Throw until the bone settles on `want` (most sides come up within a few tries).
// One simulated throw per step (so the work spreads over frames), until it settles on `want`.
function* throwFor(shape: CANNON.ConvexPolyhedron, from: { pos: THREE.Vector3; q: THREE.Quaternion }, aim: THREE.Vector3, want: Bone, calm: boolean) {
  // keep throws that settle near where they land, so no bone rolls out of the picture
  let fallback: Track | null = null;
  for (let i = 0; i < 120; i++) {
    const r = simulate(shape, from, aim, calm);
    if (r.side === want) {
      if (r.roll < 0.75) return r.track;
      fallback ??= r.track;
    }
    if (i > 60 && fallback) return fallback;
    yield;
  }
  return fallback ?? simulate(shape, from, aim, calm).track;
}

function shadowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,.8)");
  r.addColorStop(0.6, "rgba(0,0,0,.32)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}


type Piece = { mesh: THREE.Mesh; shadow: THREE.Mesh; pos: THREE.Vector3; q: THREE.Quaternion };

export function Shagai3D({ ref }: { ref?: Ref<ShagaiHandle> }) {
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const api = useRef<ShagaiHandle | null>(null);

  useImperativeHandle(ref, () => ({
    throwBones: (r, o) => api.current?.throwBones(r, o) ?? r,
    anchor: () => anchor.current,
  }), []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return;
    }
    const calmPref = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.92;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.4;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
    const key = new THREE.DirectionalLight(0xfff0d8, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9a4cf4, 1.4);
    rim.position.set(-3, 2.5, -4);
    scene.add(rim);

    // the model arrives a moment later; until then the bones are hidden
    let geo: THREE.BufferGeometry = new THREE.BufferGeometry();
    const rest: Record<Bone, number> = { sheep: 0.45, goat: 0.45, horse: 0.5, camel: 0.5 };
    const face: Record<Bone, THREE.Quaternion> = { ...FACE };
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const shTex = shadowTexture();
    const shGeo = new THREE.PlaneGeometry(1, 1);
    const shMats: THREE.MeshBasicMaterial[] = [];

    const start: Bone[] = ["horse", "sheep", "camel", "goat"];
    const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    const pieces: Piece[] = start.map((b, i) => {
      const mesh = new THREE.Mesh(geo, mat);
      const sm = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.55 });
      shMats.push(sm);
      const shadow = new THREE.Mesh(shGeo, sm);
      shadow.rotation.x = -Math.PI / 2;
      scene.add(mesh, shadow);
      mesh.visible = shadow.visible = false;
      return { mesh, shadow, pos: new THREE.Vector3(SLOTS[i], rest[b], (i % 2 ? 0.2 : -0.15)), q: new THREE.Quaternion() };
    });
    const idleYaw = [0.35, 1.95, -0.55, 2.7];
    const idleZ = [0.15, -0.3, 0.32, -0.12];
    let shape: CANNON.ConvexPolyhedron | null = null;
    let alive = true;
    const ready = loadBone().then((g) => {
      if (!alive) { g.dispose(); return; }
      geo = g;
      const poses = restPoses(g);
      shape = hullShape(g);
      for (const b of BONES_ALL) { face[b] = poses[b].q; rest[b] = poses[b].h; }
      pieces.forEach((p, i) => {
        p.mesh.geometry = g;
        p.q.copy(yawQ(idleYaw[i]).multiply(face[start[i]]));
        p.pos.set(SLOTS[i] + (i % 2 ? 0.1 : -0.08), rest[start[i]], idleZ[i]);
        p.mesh.visible = p.shadow.visible = true;
      });
    }).catch(() => {}); // no model: the throw still resolves and the chips still show the result

    let tween: { d: number; t: number; step: (s: number) => void; done: () => void } | null = null;
    const play = (d: number, step: (s: number) => void) => new Promise<void>((done) => { tween = { d, t: 0, step, done }; });

    const timer = new THREE.Timer();
    timer.connect(document);
    let shine = 0;
    const axisX = new THREE.Vector3();
    let job: Iterator<void, void> | null = null;
    renderer.setAnimationLoop(() => {
      timer.update();
      const dt = Math.min(timer.getDelta(), 1 / 20);
      if (job) {
        const t0 = performance.now();
        while (performance.now() - t0 < 6) if (job.next().done) { job = null; break; }
      }
      if (tween) {
        tween.t += dt;
        const s = tween.d > 0 ? Math.min(1, tween.t / tween.d) : 1;
        tween.step(s);
        if (s >= 1) { const t = tween; tween = null; t.done(); }
      }
      if (!calmPref) shine += dt * 0.3;
      key.position.set(Math.cos(shine) * 3.5, 6, 3 + Math.sin(shine) * 1.5);
      for (const p of pieces) {
        p.mesh.position.copy(p.pos);
        p.mesh.quaternion.copy(p.q);
        // a soft shadow under each bone, stretched along it, fading as it rises
        const h = Math.max(0, p.pos.y - 0.3);
        const k = Math.min(1, h / 2);
        axisX.set(1, 0, 0).applyQuaternion(p.q);
        p.shadow.position.set(p.pos.x, 0.002, p.pos.z);
        p.shadow.rotation.z = Math.atan2(axisX.z, axisX.x) * -1;
        p.shadow.scale.set(1.75 * (1 - 0.4 * k), 1.15 * (1 - 0.4 * k), 1);
        (p.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 - 0.4 * k;
      }
      renderer.render(scene, camera);
    });

    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // far enough back that the four landing spots fit the width, looking down ~50°
      const halfW = 3.15;
      const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(13)) * camera.aspect);
      const dist = Math.max(8, halfW / Math.tan(hHalf) + 1.2);
      const el50 = THREE.MathUtils.degToRad(50);
      camera.position.set(0, Math.sin(el50) * dist, Math.cos(el50) * dist);
      camera.lookAt(0, 0.25, 0);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      // centre the table in the card (the canvas reaches above it, for the toss)
      const card = el.parentElement?.clientHeight ?? h;
      const want = h - card / 2;
      const p = new THREE.Vector3(0, 0.25, 0).project(camera);
      camera.setViewOffset(w, h, 0, ((1 - p.y) / 2) * h - want, w, h);
      if (anchor.current) {
        anchor.current.style.left = `${w / 2}px`;
        anchor.current.style.top = `${want}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    const tmpQ = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const smoothstep = (x: number) => x * x * (3 - 2 * x);
    api.current = {
      anchor: () => anchor.current,
      async throwBones(result, opts = {}) {
        const calm = opts.calm ?? calmPref;
        await ready;
        let got: Bone[] | null = null, failed: unknown = null;
        result.then((b) => (got = b), (e) => (failed = e ?? new Error("Throw failed")));

        // 1 · scoop them up into a loose bunch, just above the table
        const hand = [new THREE.Vector3(-0.85, 0.05, -0.3), new THREE.Vector3(-0.25, 0.3, 0.42), new THREE.Vector3(0.3, -0.02, -0.38), new THREE.Vector3(0.88, 0.25, 0.3)];
        const handY = calm ? 0.75 : 0.95, handZ = 0.55;
        const from = pieces.map((p) => ({ pos: p.pos.clone(), q: p.q.clone() }));
        const handQ = pieces.map((_, i) => new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 1.3 + 0.4, i * 2.1, i * 0.7)));
        await play(0.28, (s) => {
          const e = smoothstep(s);
          pieces.forEach((p, i) => {
            p.pos.lerpVectors(from[i].pos, new THREE.Vector3(hand[i].x, handY + hand[i].y, handZ + hand[i].z), e);
            p.q.slerpQuaternions(from[i].q, handQ[i], e);
          });
        });
        // 2 · shuffle in the cupped hands. Once the answer is in, work out each bone's throw in the
        //     background (a few ms per frame) while they keep shuffling; throw when it's ready.
        const base = pieces.map((p) => ({ pos: p.pos.clone(), q: p.q.clone() }));
        const done: { tracks: Track[] | null } = { tracks: null };
        const work = function* (land: Bone[]) {
          const out: Track[] = [];
          for (let i = 0; i < land.length; i++) {
            const aim = new THREE.Vector3(SLOTS[i] + (Math.random() - 0.5) * 0.16, 0, (Math.random() - 0.5) * 0.5);
            const track: Track = yield* throwFor(shape!, base[i], aim, land[i], calm);
            // nudge the landing spot into this bone's place in the row; the table is flat, so a
            // sideways shift (eased in before the first bounce) is still a true throw
            const k = track.n - 1;
            const dx = aim.x - track.pos[k * 3], dz = aim.z - track.pos[k * 3 + 2];
            for (let f = 0; f < track.n; f++) {
              const w = f >= track.hit ? 1 : smoothstep(f / Math.max(1, track.hit));
              track.pos[f * 3] += dx * w;
              track.pos[f * 3 + 2] += dz * w;
            }
            out.push(track);
            yield;
          }
          done.tracks = out;
        };
        let shook = 0, started = false;
        while (shook < 3 || (failed === null && done.tracks === null)) {
          if (!started && got !== null && shape) { started = true; job = work(got); }
          const phase = shook++;
          await play(0.15, (s) => {
            const a = Math.sin(s * Math.PI) * (calm ? 0.04 : 0.09);
            pieces.forEach((p, i) => {
              const dir = (i + phase) % 2 ? 1 : -1;
              p.pos.copy(base[i].pos).add(new THREE.Vector3(dir * a, a * 1.2, -dir * a * 0.6));
              tmpQ.setFromEuler(new THREE.Euler(a * 2.2 * dir, a * 3, -a * 2 * dir));
              p.q.copy(base[i].q).multiply(tmpQ);
            });
          });
          if (!shape && got !== null) break; // no physics shape: nothing to wait for
        }
        // a failed call (or no model): lay them back down where they were, gently
        if (failed || !done.tracks) {
          job = null;
          await play(0.35, (s) => {
            const e = smoothstep(s);
            pieces.forEach((p, i) => { p.pos.lerpVectors(base[i].pos, from[i].pos, e); p.q.slerpQuaternions(base[i].q, from[i].q, e); });
          });
          if (failed) throw failed;
          return got ?? start;
        }
        const land = got!;
        const ready4: Track[] = done.tracks;
        // 4 · play the recordings back, released a hair apart
        const lag = calm ? 0.02 : 0.05;
        const total = Math.max(...ready4.map((t, i) => (t.n - 1) / 60 + i * lag));
        const touched = [false, false, false, false];
        await play(total, (s) => {
          const t = s * total;
          pieces.forEach((p, i) => {
            const tr = ready4[i];
            const f = THREE.MathUtils.clamp((t - i * lag) * 60, 0, tr.n - 1);
            const f0 = Math.floor(f), f1 = Math.min(tr.n - 1, f0 + 1), u = f - f0;
            p.pos.set(
              tr.pos[f0 * 3] + (tr.pos[f1 * 3] - tr.pos[f0 * 3]) * u,
              tr.pos[f0 * 3 + 1] + (tr.pos[f1 * 3 + 1] - tr.pos[f0 * 3 + 1]) * u,
              tr.pos[f0 * 3 + 2] + (tr.pos[f1 * 3 + 2] - tr.pos[f0 * 3 + 2]) * u,
            );
            qa.fromArray(tr.quat, f0 * 4);
            qb.fromArray(tr.quat, f1 * 4);
            p.q.slerpQuaternions(qa, qb, u);
            if (!touched[i] && f >= tr.hit) { touched[i] = true; opts.onTouch?.(i); }
          });
        });
        return land;
      },
    };

    return () => {
      api.current = null;
      alive = false;
      ro.disconnect();
      renderer.setAnimationLoop(null);
      timer.dispose();
      geo.dispose();
      mat.dispose();
      shGeo.dispose();
      shTex.dispose();
      shMats.forEach((m) => m.dispose());
      env.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="shagai3d-box" ref={box}>
      <span className="coin3d-anchor" ref={anchor} />
    </div>
  );
}
