import { notFound } from "next/navigation";
import { IssuerHeader } from "@/components/issuer/IssuerHeader";
import { IssuerProfileBody } from "@/components/issuer/IssuerProfileBody";
import { listIssuers, loadIssuerBySlug } from "@/lib/issuers";

export const dynamicParams = false;

export function generateStaticParams() {
  return listIssuers().map((issuer) => ({ slug: issuer.slug }));
}

export default async function IssuerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issuer = loadIssuerBySlug(slug);

  if (!issuer) {
    notFound();
  }

  return (
    <main className="hadron-shell space-y-5 pb-16 pt-5 text-text sm:pb-24 sm:pt-6">
      <IssuerHeader issuer={issuer} />
      <IssuerProfileBody issuer={issuer} />
    </main>
  );
}
