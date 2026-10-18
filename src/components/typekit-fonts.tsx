"use client";

import Script from "next/script";

type TypekitWindow = Window & {
  Typekit?: { load: (options: { async: boolean; kitId: string; scriptTimeout: number }) => void };
};

export function TypekitFonts() {
  return <Script id="anuconsole-typekit" src="https://use.typekit.net/vjg4wuk.js" strategy="afterInteractive" onReady={() => {
    (window as TypekitWindow).Typekit?.load({ async: true, kitId: "vjg4wuk", scriptTimeout: 3000 });
  }} />;
}
