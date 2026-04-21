import React from "react";
import { getHighlightSegments } from "./vehicles.utils";

interface HighlightMatchProps {
  text: string;
  query: string;
}

const HighlightMatch: React.FC<HighlightMatchProps> = ({ text, query }) => {
  const segments = getHighlightSegments(text, query);

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0.5"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
};

export default HighlightMatch;
