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
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-24 pt-6 text-text sm:px-6 lg:px-8">
      <IssuerHeader issuer={issuer} />
      <IssuerProfileBody issuer={issuer} />
    </main>
  );
}
