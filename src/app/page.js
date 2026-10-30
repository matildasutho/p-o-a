import HomeExperience from "@/components/home/HomeExperience";
import { getSequenceAssets } from "@/lib/sequence";

export default function Home() {
  const assets = getSequenceAssets();

  return <HomeExperience assets={assets} />;
}
