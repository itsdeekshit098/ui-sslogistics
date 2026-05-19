import Image from "next/image";

import * as styles from "./partnerLogo.style";
import { PartnerLogoProps } from "./partnerLogo.types";

interface PartnerAsset {
  src: string;
  alt: string;
  /** Scale override for images with excessive internal whitespace */
  scale?: number;
}

/**
 * Partner logo asset registry.
 *
 * To add a new partner:
 *   1. Drop the logo image into /public/partners/
 *   2. Add an entry below with the key matching the name in partnerNames.
 *   3. If the image has lots of whitespace, add a `scale` value (e.g. 1.6)
 *   That's it — the homepage carousel handles any number of partners.
 */
const partnerLogoAssets: Record<string, PartnerAsset> = {
  ACT: { src: "/partners/act-v3.png", alt: "ACT Plast Paints Logo" },
  BOGOOK: { src: "/partners/boogook-v2.png", alt: "Bogook Logo" },
  SLAP: { src: "/partners/slap-v4.png", alt: "SLAP Logo" },
  "SWIFT SUPPORT SERVICE": {
    src: "/partners/swift.png",
    alt: "Swift Support Service Logo",
  },
  SUPREME: { src: "/partners/supreme.png", alt: "Supreme Group Logo" },
  WOOYOUNG: {
    src: "/partners/wooyoung.png",
    alt: "Wooyoung Automotive Logo",
    scale: 1.8,
  },
};

/**
 * Renders a partner logo image that fills its parent container.
 * The parent (partnerLogoShell) must be position:relative for `fill` to work.
 */
export function PartnerLogo({ name }: PartnerLogoProps) {
  const logo = partnerLogoAssets[name];

  if (!logo) {
    return <span style={styles.fallbackLogo}>{name}</span>;
  }

  const imageStyle = logo.scale
    ? { ...styles.logoImage, transform: `scale(${logo.scale})` }
    : styles.logoImage;

  return (
    <Image
      alt={logo.alt}
      fill
      priority={false}
      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 44vw, 240px"
      src={logo.src}
      style={imageStyle}
    />
  );
}
