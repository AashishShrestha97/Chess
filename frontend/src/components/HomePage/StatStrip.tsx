import React from "react";
import "./StatStrip.css";

type Item = { icon: string; label: string; value: string };

const StatStrip: React.FC<{ items: Item[] }> = ({ items }) => (
  <div className="statstrip">
    {items.map((it, i) => (
      <div className="statchip" key={i}>
        <div className="chip-icon">{it.icon}</div>
        <div>
          <div className="val">{it.value}</div>
          <div className="lab">{it.label}</div>
        </div>
      </div>
    ))}
  </div>
);

export default StatStrip;
