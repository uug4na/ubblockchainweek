import type { Metadata } from "next";
import { GetInvolved } from "@/components/GetInvolved";

export const metadata: Metadata = { title: "Get involved" };

export default function GetInvolvedPage() {
  return (
    <section className="gi-band">
      <div className="t-wrap">
        <GetInvolved />
      </div>
    </section>
  );
}
