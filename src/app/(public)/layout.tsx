import { PublicFooter } from "@/components/publicFooter";
import { PublicNavbar } from "@/components/publicNavbar";

import { publicLayoutMain, publicLayoutShell } from "./publicLayout.style";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={publicLayoutShell}>
      <PublicNavbar />
      <main style={publicLayoutMain}>{children}</main>
      <PublicFooter />
    </div>
  );
}
