import { createClient } from "@sanity/client";

export const sanityClient = createClient({
  projectId: "xybbpp0d",
  dataset: "production",
  apiVersion: "2024-06-27",
  useCdn: false,
});
