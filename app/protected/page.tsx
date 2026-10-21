import { redirect } from "next/navigation";
export default function LegacyProtectedPage() {
  redirect("/");
}
