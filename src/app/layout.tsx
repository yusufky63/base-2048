import type { Metadata } from 'next'
import { WagmiProvider } from '@/app/providers/WagmiProvider'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const miniapp = {
  version: "1",
  imageUrl: "https://base-2048.vercel.app/og-image.png", // 3:2 aspect ratio image
  button: {
    title: "🎮 Play Base 2048",
    action: {
      type: "launch_miniapp",
      name: "Base 2048",
      url: "https://base-2048.vercel.app/",
      splashImageUrl: "https://base-2048.vercel.app/splash.png",
      splashBackgroundColor: "#ffffff"
    }
  }
}

export const metadata: Metadata = {
  title: "Base 2048",
  description: "Play the classic 2048 puzzle game on Base",
  openGraph: {
    title: "Base 2048",
    description: "Classic 2048 game on Base",
    images: ["https://base-2048.vercel.app/og-image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify(miniapp),
    "fc:frame": JSON.stringify(miniapp) // For backward compatibility
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <WagmiProvider>
          {children}
          <Toaster 
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1C2333',
                color: '#fff',
                borderRadius: '12px',
                border: '1px solid #C5D5FF',
                fontSize: '14px',
                fontWeight: '500',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </WagmiProvider>
      </body>
    </html>
  )
}
