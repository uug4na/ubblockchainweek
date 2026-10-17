import Image from "next/image";
import { site } from "@/lib/site";

type Props = { priority?: boolean; className?: string };

export default function Brand({ priority = false, className = "" }: Props) {
  return (
    <a className={`brand ${className}`.trim()} href="#top" aria-label={`${site.title}, back to top`}>
      <Image className="brand__logo" src="/assets/logo-white.png" alt={site.name} width={1014} height={349} priority={priority} />
      <span className="year-badge year-badge--nav" aria-hidden="true">
        {site.year}
      </span>
    </a>
  );
}
