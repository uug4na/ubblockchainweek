"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn btn-primary btn-lg" onClick={() => window.print()}>
      <Printer size={18} /> Print this day
    </button>
  );
}
