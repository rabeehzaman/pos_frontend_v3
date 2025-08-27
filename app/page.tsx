import { POSPage } from '@/components/pos/pos-page'
import { ClientOnly } from '@/components/client-only'

export default function Home() {
  return (
    <ClientOnly
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading POS...</p>
          </div>
        </div>
      }
    >
      <POSPage />
    </ClientOnly>
  )
}
