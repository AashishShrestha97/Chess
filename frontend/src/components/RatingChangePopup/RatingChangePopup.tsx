// frontend/src/components/RatingChangePopup/RatingChangePopup.tsx
import React, { useEffect, useState } from "react";
import "./RatingChangePopup.css";

interface Props {
  change: number;        // signed rating change
  newRating: number;     // new absolute rating
  onClose?: () => void;
}

const RatingChangePopup: React.FC<Props> = ({ change, newRating, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onClose?.(); }, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!visible) return null;

  const isGain = change >= 0;
  const sign   = isGain ? "+" : "";

  return (
    <div className={`rcp-overlay ${isGain ? "gain" : "loss"}`}>
      <div className="rcp-card">
        <div className="rcp-icon">{isGain ? "📈" : "📉"}</div>
        <div className="rcp-label">Rating Change</div>
        <div className={`rcp-change ${isGain ? "gain" : "loss"}`}>
          {sign}{Math.round(change)}
        </div>
        <div className="rcp-new">
          New rating: <strong>{Math.round(newRating)}</strong>
        </div>
      </div>
    </div>
  );
};

export default RatingChangePopup;