import { sanityClient } from "@/sanity/client";
import { groq } from "next-sanity";
import Project from "@/components/projects/Project";

const PROJECT_QUERY = groq`
    *[_type == "project"]{
    _id,
    name,
    date,
    description,
    images[]{
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height,
      "mimeType": asset->mimeType,
      "filename": asset->originalFilename
    }}
`;

export default async function ProjectPage() {
  const projects = await sanityClient.fetch(PROJECT_QUERY);

  return (
    <div>
      {projects.map((project, index) => (
        <Project key={project._id} project={project} index={index} />
      ))}
    </div>
  );
}
