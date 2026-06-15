import BlockedPageClient from "@/components/BlockedPageClient";

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  return <BlockedPageClient country={country} />;
}
