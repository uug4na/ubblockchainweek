"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UserPlus } from "lucide-react";
import { BusinessCard, type CardPerson } from "@/components/BusinessCard";
import { parseCode } from "@/lib/codes";
import { saveContact } from "@/lib/socials";
import { supabase } from "@/lib/supa/client";

export function PublicCard() {
  const code = useSearchParams().get("c") ?? "";
  const [person, setPerson] = useState<CardPerson | null | undefined>(undefined);

  useEffect(() => {
    const s = parseCode(code);
    if (s?.kind !== "user") return setPerson(null);
    supabase()
      .rpc("card_view", { pass_code: s.id })
      .then(({ data }) => setPerson((data as CardPerson | null) ?? null), () => setPerson(null));
  }, [code]);

  if (person === undefined) return null;
  if (person === null)
    return (
      <div className="card-missing">
        <h1 className="app-h1">No card here.</h1>
        <Link href="/" className="btn btn-ghost">UB Blockchain Week</Link>
      </div>
    );

  return (
    <>
      <BusinessCard person={person} />
      <div className="card-actions">
        <button className="btn btn-clay btn-lg wide" onClick={() => saveContact({ ...person, socials: person.socials ?? {} })}>
          <UserPlus size={18} /> Save contact
        </button>
        <Link href={`/app/scan/?c=${encodeURIComponent(code)}`} className="btn btn-ghost btn-lg wide">Connect in the UBBW app</Link>
      </div>
    </>
  );
}
