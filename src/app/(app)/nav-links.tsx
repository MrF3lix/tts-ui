"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Generate" },
  { href: "/saved", label: "Saved" },
  { href: "/speakers", label: "Speakers" },
  { href: "/status", label: "Status" },
] as const

// The pathname of pages with an id (/saved/[id]) is only known at request time, so the
// prerendered layout shows the links without the current one highlighted until it is.
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <CurrentNavLinks />
    </Suspense>
  )
}

function CurrentNavLinks() {
  return <Links pathname={usePathname()} />
}

function Links({ pathname }: { pathname: string | null }) {
  // sub-pages such as a sample's annotation belong to their section
  const isActive = (href: string) => !!pathname && (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
  return (
    <nav className="flex items-center gap-3 text-sm sm:gap-4">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn("text-muted-foreground hover:text-foreground", isActive(href) && "text-foreground font-medium")}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
