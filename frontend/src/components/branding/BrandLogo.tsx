import clsx from "clsx";

type BrandTone = "gold" | "ink" | "light";
type BrandSize = "sm" | "md";

type BrandLogoProps = {
  tone?: BrandTone;
  size?: BrandSize;
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
};

const toneStyles: Record<
  BrandTone,
  {
    stroke: string;
    glow: string;
    title: string;
    subtitle: string;
  }
> = {
  gold: {
    stroke: "#DAB566",
    glow: "drop-shadow(0 0 14px rgba(218, 181, 102, 0.35))",
    title: "text-gold-300",
    subtitle: "text-zinc-400"
  },
  ink: {
    stroke: "#0F2246",
    glow: "none",
    title: "text-[#0F2246]",
    subtitle: "text-slate-500"
  },
  light: {
    stroke: "#EDE7D2",
    glow: "drop-shadow(0 0 14px rgba(237, 231, 210, 0.25))",
    title: "text-zinc-100",
    subtitle: "text-zinc-400"
  }
};

export function BrandLogo({
  tone = "gold",
  size = "md",
  className,
  showWordmark = true,
  subtitle = "SaaS para lojas de carros"
}: BrandLogoProps) {
  const style = toneStyles[tone];
  const markSize = size === "sm" ? "h-10 w-12 sm:h-11 sm:w-14" : "h-12 w-16 sm:h-14 sm:w-[4.5rem]";
  const titleSize = size === "sm" ? "text-xl sm:text-2xl" : "text-2xl sm:text-[1.75rem]";
  const subtitleSize = size === "sm" ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs";

  return (
    <div className={clsx("inline-flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 320 220"
        role="img"
        aria-label="Logo VitrineAuto"
        className={clsx("shrink-0", markSize)}
      >
        <g
          fill="none"
          stroke={style.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: style.glow }}
        >
          <path d="M98 146V95C98 58 126 32 160 32C194 32 222 58 222 95V146" strokeWidth="7" />
          <path d="M109 146V95C109 64 131 41 160 41C189 41 211 64 211 95V146" strokeWidth="5" />
          <path d="M90 146V184H230V146" strokeWidth="7" />
          <path d="M54 136C68 136 80 133 92 127L109 117C120 110 134 106 147 106H207C222 106 236 112 247 123L253 129C262 135 273 137 284 137" strokeWidth="7" />
          <path d="M58 136L52 147L54 159C55 167 63 173 71 173H86" strokeWidth="7" />
          <path d="M278 137L286 145L282 160C280 168 273 173 265 173H233" strokeWidth="7" />
          <path d="M120 116C130 111 138 109 147 109H205C216 109 226 113 235 120" strokeWidth="5" />
          <path d="M132 119H190" strokeWidth="5" />
          <path d="M162 106L164 122" strokeWidth="5" />
          <circle cx="95" cy="173" r="18" strokeWidth="7" />
          <circle cx="225" cy="173" r="18" strokeWidth="7" />
        </g>
      </svg>

      {showWordmark ? (
        <div className="leading-tight">
          <p className={clsx("font-display tracking-[0.08em]", titleSize, style.title)}>
            VITRINEAUTO
          </p>
          <p className={clsx("uppercase tracking-[0.24em]", subtitleSize, style.subtitle)}>{subtitle}</p>
        </div>
      ) : null}
    </div>
  );
}
