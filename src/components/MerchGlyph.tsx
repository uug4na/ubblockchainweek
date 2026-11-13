import { Shirt, ShoppingBag, KeyRound, Pin, Snowflake, Wallet, NotebookPen, Coffee, Sticker, GlassWater, Backpack, BatteryCharging, Headphones, Footprints } from "lucide-react";
import type { MerchItem } from "@/data/rewards";

const icons = { shirt: Shirt, bag: ShoppingBag, key: KeyRound, pin: Pin, hat: Snowflake, wallet: Wallet, book: NotebookPen, coffee: Coffee, sticker: Sticker, bottle: GlassWater, backpack: Backpack, battery: BatteryCharging, headphones: Headphones, socks: Footprints };

// Stand-in artwork until product photos arrive.
export function MerchGlyph({ item, size = 44 }: { item: MerchItem; size?: number }) {
  const Icon = icons[item.glyph];
  return (
    <div className="merch-art" style={{ ["--h" as string]: item.hue }}>
      <Icon size={size} strokeWidth={1.5} />
    </div>
  );
}
