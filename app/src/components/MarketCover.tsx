import Image from "next/image";
import { resolveMarketImageUrl } from "@/lib/market-media";

type Variant = "card" | "hero" | "thumb";

type Props = {
  id?: string;
  slug?: string | null;
  imageUrl?: string | null;
  title: string;
  kind?: string;
  variant?: Variant;
  priority?: boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  card: "market-cover market-cover--card",
  hero: "market-cover market-cover--hero",
  thumb: "market-cover market-cover--thumb",
};

export function MarketCover({
  id,
  slug,
  imageUrl,
  title,
  kind,
  variant = "card",
  priority = false,
}: Props) {
  const src = resolveMarketImageUrl({ id, slug, imageUrl });
  const className = `${VARIANT_CLASS[variant]} market-cover--${kind ?? "default"}`;

  if (!src) {
    return (
      <div className={className} aria-hidden>
        <div className="market-cover-fallback" />
      </div>
    );
  }

  const isRemote = src.startsWith("http://") || src.startsWith("https://");

  return (
    <div className={className}>
      {isRemote ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${title} 封面`} className="market-cover-img" />
      ) : (
        <Image
          src={src}
          alt={`${title} 封面`}
          fill
          sizes={
            variant === "hero"
              ? "(max-width: 768px) 100vw, 720px"
              : variant === "thumb"
                ? "96px"
                : "(max-width: 768px) 100vw, 320px"
          }
          className="market-cover-img"
          priority={priority}
        />
      )}
    </div>
  );
}
