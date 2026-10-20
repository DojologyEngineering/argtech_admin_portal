import { cn } from "cn";

/**
 * The ARG TECH logo: the sprout-over-bowl mark and the wordmark, from the brand
 * artwork in `public/brand`. `white` is for the dark green sidebar and the green
 * login panel; `green` is for light backgrounds.
 */
type Tone = "white" | "green";

const MARK: Record<Tone, string> = {
  white: "/brand/arg-tech-mark-white.png",
  green: "/brand/arg-tech-mark.png",
};
const WORDMARK: Record<Tone, string> = {
  white: "/brand/arg-tech-wordmark-white.png",
  green: "/brand/arg-tech-wordmark.png",
};

export function BrandMark({
  tone = "green",
  className,
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MARK[tone]}
      alt=""
      aria-hidden
      width={533}
      height={418}
      className={cn("h-8 w-auto shrink-0", className)}
    />
  );
}

export function BrandWordmark({
  tone = "green",
  className,
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={WORDMARK[tone]}
      alt="ARG TECH"
      width={766}
      height={70}
      className={cn("h-3 w-auto shrink-0", className)}
    />
  );
}

/** Mark beside the wordmark, as used in the sidebar. */
export function BrandLockup({
  tone = "white",
  className,
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark tone={tone} className="h-7" />
      <BrandWordmark tone={tone} className="h-3" />
    </span>
  );
}
