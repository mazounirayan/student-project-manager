import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"

import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ConfirmHost } from "@/components/ui/confirm-host"
import { Suspense } from "react"
import { APP_NAME } from "@/lib/app"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Promotions, projets, groupes, livrables, rapports, soutenances et notation pour les enseignants et les étudiants.",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <AuthProvider>{children}</AuthProvider>
          </Suspense>
          <Toaster position="bottom-right" />
          <ConfirmHost />
        </ThemeProvider>
      </body>
    </html>
  )
}
