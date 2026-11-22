"use client";

import { useState } from "react";
import { initialsOf } from "./avatar.utils";
import { Photo, Root } from "./avatar.styles";
import type { AvatarProps } from "./avatar.types";

/** A round marker for a person or entity: their photo, or their initials. */
export function Avatar({ name, src, size = "md", ...props }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = !!src && failedSrc !== src;

  return (
    <Root data-ui="avatar" role="img" aria-label={name} $size={size} {...props}>
      {showPhoto ? (
        <Photo src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </Root>
  );
}
