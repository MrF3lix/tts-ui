"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/", label: "Generate" },
  { href: "/saved", label: "Saved" },
  { href: "/speakers", label: "Speakers" },
  { href: "/status", label: "Status" },
] as const

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-3 text-sm sm:gap-4">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn("text-muted-foreground hover:text-foreground", pathname === href && "text-foreground font-medium")}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
