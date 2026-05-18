"use client";
import { useState } from "react";

export default function Project({ project, index }) {
  const [showImages, setShowImages] = useState(false);

  return (
    <div>
      <span
        className="project-row"
        onClick={() => setShowImages((prev) => !prev)}
      >
        <p>0{index}</p>
        <p alt="project title">{project.name}</p>
      </span>

      <div className={`gallery ${showImages ? "" : "hidden"}`}>
        <p>{project.description}</p>
        <div className="gallery-inner">
          {project.images?.map((image, i) => (
            <img
              key={i}
              src={image.url}
              width="auto"
              height="323px"
              alt={image.filename}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
