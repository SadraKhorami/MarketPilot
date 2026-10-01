import { notFound } from "next/navigation";

const sections = ["architecture", "daily", "setup", "bots", "billing", "deploy", "troubleshooting"] as const;

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { section } = await params;
  const selectedSection = sections.find((item) => item === section);
  if (!selectedSection) notFound();
  const { DevelopmentDocs } = await import("../_components/development-docs");
  return <DevelopmentDocs section={selectedSection} />;
}
