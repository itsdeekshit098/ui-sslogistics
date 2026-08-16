import { redirect } from "next/navigation";

// Vehicle owners merged into the unified entities master (sql/28_add_entities.sql),
// which also carries loan borrowers. Kept as a redirect so existing bookmarks
// and any lingering links don't 404.
export default function Page() {
  redirect("/admin/entities");
}
