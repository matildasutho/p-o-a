import { cookies } from "next/headers";
import HomeExperience from "@/components/home/HomeExperience";
import { INTRO_SEEN_COOKIE } from "@/lib/intro";
import { getSequenceAssets } from "@/lib/sequence";

export default async function Home() {
  const assets = getSequenceAssets();
  // Set by HomeExperience once the intro loader has played this session.
  const introSeen = (await cookies()).get(INTRO_SEEN_COOKIE)?.value === "1";

  return <HomeExperience assets={assets} introSeen={introSeen} />;
}
