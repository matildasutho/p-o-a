import ImageSequence from "@/components/home/ImageSequence";
import { getSequenceAssets } from "@/lib/sequence";

export default function Home() {
  const assets = getSequenceAssets();

  return <ImageSequence assets={assets} />;
}
