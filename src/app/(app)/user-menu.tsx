import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { logout } from "./actions"

export async function UserMenu() {
  const user = await getCurrentUser()
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline" title={user.email}>{user.name}</span>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">Sign out</Button>
      </form>
    </div>
  )
}
