"use client";

// Quiz Rush state, shared by the app-wide pop-up, the games list and the quiz screen.
// One poller: it sleeps until the next question drops, polls every few seconds while one is
// live (hint letters, who's answered), then sleeps again.
import { useSyncExternalStore } from "react";
import { api, setMe, type Me } from "@/lib/me";

export type QuizWinner = { rank: number; name: string; ms: number; points: number; me: boolean };
export type QuizRound = {
  slot: number; opensAt: number; closesAt: number; open: boolean;
  question: string; hint: string; answer: string | null;
  solved: number; spots: number;
  mine: { rank: number; points: number; ms: number } | null;
  winners: QuizWinner[];
};
export type QuizMe = { points: number; wins: number; rank: number | null };
export type QuizRules = { entry: number; openSec: number; hours: string; points: number[] };
// joined/rules come from migration 0023; before it runs they're missing and everyone counts as joined.
export type QuizNow = { now: number; nextAt: number | null; everyMin: number; round: QuizRound | null; prev: QuizRound | null; me: QuizMe; joined?: boolean; rules?: QuizRules };
export const isPlayer = (q: QuizNow | null) => !!q && q.joined !== false;
export type QuizGuess = { correct: boolean; close?: boolean; rank?: number; points?: number; ms?: number; round: QuizRound; quiz?: QuizMe };

const LIVE_MS = 3000;
let data: QuizNow | null = null;
let skew = 0; // server clock minus this phone's clock
let timer: ReturnType<typeof setTimeout> | undefined;
let users = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const serverNow = () => Date.now() + skew;

function schedule() {
  clearTimeout(timer);
  if (!users || !data) return;
  const live = data.round?.open;
  // spread the wake-up over a second so everyone doesn't hit the database at the same instant
  const wait = live ? LIVE_MS : data.nextAt ? Math.max(1000, data.nextAt - serverNow() + 300 + Math.random() * 1200) : 5 * 60_000;
  timer = setTimeout(() => (document.visibilityState === "visible" ? refreshQuiz() : schedule()), Math.min(wait, 10 * 60_000));
}

export async function refreshQuiz() {
  try {
    const t0 = Date.now();
    const r = await api<QuizNow>("/api/rpc/app_quiz_now", {});
    skew = r.now - (t0 + Date.now()) / 2;
    data = r;
    emit();
  } catch {}
  schedule();
}

export function patchRound(round: QuizRound, me?: QuizMe) {
  if (!data) return;
  data = { ...data, round: data.round?.slot === round.slot ? round : data.round, me: me ?? data.me };
  emit();
}

export async function guess(slot: number, text: string) {
  const r = await api<Me & QuizGuess>("/api/rpc/app_quiz_guess", { slot, guess: text });
  if (r.correct) setMe(r);
  patchRound(r.round, r.quiz);
  return r;
}

// Pay the entry once; afterwards the live question, answering and the alert open up.
export async function joinQuiz() {
  const r = await api<Me & { joined: boolean }>("/api/rpc/app_quiz_join", {});
  setMe(r);
  await refreshQuiz();
}

function onVisible() {
  if (document.visibilityState === "visible") refreshQuiz();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Call from a component that is mounted while signed in; polling runs while any is mounted.
export function startQuiz() {
  if (users++ === 0) {
    refreshQuiz();
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    if (--users === 0) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

export function useQuiz() {
  return useSyncExternalStore(subscribe, () => data, () => null);
}

export const secs = (ms: number) => (ms / 1000).toFixed(1) + "s";
export const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
