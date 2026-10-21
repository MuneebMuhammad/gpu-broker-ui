import { redirect } from "next/navigation";
import { pageContext } from "@/lib/requests";
import { hasAdminAccess } from "@/lib/admin";
export async function GET() {
  const context = await pageContext();
  redirect((await hasAdminAccess(context)) ? "/admin" : "/");
}
