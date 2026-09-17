import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import ViewportVars from "@/components/ViewportVars";
import AuthDebugPanel from "@/components/AuthDebugPanel";
import AuthBootBeacon from "@/components/AuthBootBeacon";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SumuNote",
  description: "极简主义者的私有云盘",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning> 
      <head />
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=location.search.indexOf('debugAuth=1')>=0;var on=q||localStorage.getItem('sumu:debugAuth')==='1';if(q)localStorage.setItem('sumu:debugAuth','1');if(!on)return;var k='sumu:auth-debug';var list=[];try{list=JSON.parse(localStorage.getItem(k)||'[]')}catch(e){}list.push({t:Date.now(),step:'html-boot',detail:{path:location.pathname+location.search}});localStorage.setItem(k,JSON.stringify(list.slice(-50)));}catch(e){}})();`,
          }}
        />
        <ViewportVars />
        {/* 2. 包裹内容，设置默认属性 */}
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
            <AuthBootBeacon />
            <AuthDebugPanel />
          </ThemeProvider>
      </body>
    </html>
  )
}
