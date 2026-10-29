import { forward } from "@/lib/gateway"

export async function GET(request: Request) {
  return forward(request, "/models")
}
