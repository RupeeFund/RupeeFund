import colors from "@rupeefund/ui/colors.json";
import { BrandMark } from "@/components/og/brand-mark";

export interface LogoProps {
  logo: string;
  logoWidth: number;
  logoHeight: number;
  clearSpace: number;
  tagline?: string;
  caption?: string;
}

export const Logo = ({ logo, logoWidth, logoHeight, clearSpace, tagline, caption }: LogoProps) => (
  <div
    style={{
      alignItems: "center",
      backgroundColor: colors.white,
      color: colors.ink,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      justifyContent: "center",
      padding: `${clearSpace}px`,
      width: "100%",
    }}
  >
    <BrandMark
      radius={0}
      size={logoWidth}
      src={logo}
      style={{ height: logoHeight, width: logoWidth }}
    />

    {tagline ? (
      <div
        style={{
          flexShrink: 0,
          fontSize: "40px",
          fontWeight: 600,
          letterSpacing: "-0.033em",
          lineHeight: 1.15,
          marginTop: `${clearSpace}px`,
          textAlign: "center",
          textWrap: "balance",
        }}
      >
        {tagline}
      </div>
    ) : null}

    {caption ? (
      <div
        style={{
          color: colors["ink-2"],
          display: "flex",
          fontSize: "28px",
          fontWeight: 400,
          marginTop: "12px",
        }}
      >
        {caption}
      </div>
    ) : null}
  </div>
);
