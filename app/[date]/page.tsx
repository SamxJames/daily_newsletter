import { notFound } from "next/navigation";
import DigestView from "../components/Digest";
import { displayDate, loadConfig } from "@/scripts/lib/config";
import { listDigestDates, readDigest } from "@/scripts/lib/store";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const daily = listDigestDates("daily").map((date) => ({ date }));
  const weekly = listDigestDates("weekly").map((date) => ({ date: `${date}-weekly` }));
  return [...daily, ...weekly];
}

export default function DatedDigest({ params }: { params: { date: string } }) {
  const config = loadConfig();
  const isWeekly = params.date.endsWith("-weekly");
  const date = params.date.replace("-weekly", "");
  const digest = readDigest(date, isWeekly ? "weekly" : "daily");

  if (!digest) notFound();

  return (
    <DigestView digest={digest} dateLabel={displayDate(config.owner.timezone, digest.date)} />
  );
}
