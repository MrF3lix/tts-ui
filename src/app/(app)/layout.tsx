import { Suspense } from "react"
import Link from "next/link"
import { NavLinks } from "./nav-links"
import { UserMenu } from "./user-menu"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="font-semibold">TTS</Link>
            <NavLinks />
          </div>
          {/* reads the session, so it streams in after the static shell */}
          <Suspense fallback={<div className="h-8 w-40" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </>
  )
}
