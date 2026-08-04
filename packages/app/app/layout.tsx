import type { Metadata } from "next";
import "./globals.css";
import { PersonaNav } from "./nav";
import { ActiveDeploymentProvider } from "@/lib/active-deployment";

export const metadata: Metadata = {
  title: "Green Road — Private Commerce on Stellar",
  description:
    "A privacy-preserving marketplace demo powered by confidential USDC escrow on Stellar Testnet.",
};

// The high-contrast light palette is the canonical neo-brutalist presentation.
// Keep a user-selected dark theme, but do not let OS defaults silently override it.
const themeInit = `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ActiveDeploymentProvider>
          <PersonaNav />
          {children}
        </ActiveDeploymentProvider>
      </body>
    </html>
  );
}
