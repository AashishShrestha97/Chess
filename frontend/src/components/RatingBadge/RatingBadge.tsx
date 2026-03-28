// frontend/src/components/RatingBadge/RatingBadge.tsx
import React from "react";
import { displayRating, rdLabel } from "../../api/ratings";
import type { RatingProfile } from "../../api/ratings";
import "./RatingBadge.css";

interface Props {
  profile: RatingProfile;
  /** compact = just the number; full = number + RD label */
  variant?: "compact" | "full";
}

const RatingBadge: React.FC<Props> = ({ profile, variant = "compact" }) => {
  const rating = displayRating(profile.glickoRating);
  const label  = rdLabel(profile.glickoRd);

  if (variant === "compact") {
    return (
      <span className="rating-badge-glicko" title={`RD: ${Math.round(profile.glickoRd)} — ${label}`}>
        {rating}
      </span>
    );
  }

  return (
    <div className="rating-badge-full">
      <span className="rating-value">{rating}</span>
      <span className="rating-label">{label}</span>
      <span className="rating-rd" title="Rating Deviation — lower = more reliable">
        ±{Math.round(profile.glickoRd)}
      </span>
    </div>
  );
};

export default RatingBadge;