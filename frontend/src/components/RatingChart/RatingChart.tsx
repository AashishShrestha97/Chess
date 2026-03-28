// frontend/src/components/RatingChart/RatingChart.tsx
import React, { useRef, useEffect, useState } from "react";
import type { RatingHistoryEntry } from "../../api/ratings";
import "./RatingChart.css";

interface Props {
  history: RatingHistoryEntry[];
  height?: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  rating: number;
  change: number;
  date: string;
}

const RatingChart: React.FC<Props> = ({ history, height = 160 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, rating: 0, change: 0, date: "",
  });
  const [width, setWidth] = useState(0);

  // ── Padding / layout constants ────────────────────────────────────────────
  const PAD = { top: 16, right: 16, bottom: 32, left: 44 };

  // ── Prepare data ──────────────────────────────────────────────────────────
  const data = (history || []).map((h) => ({
    ...h,
    rating: Math.round(h.rating),
    date: new Date(h.recordedAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    }),
  }));

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(wrapperRef.current);
    setWidth(wrapperRef.current.offsetWidth);
    return () => ro.disconnect();
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || width === 0 || data.length === 0) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const chartW = width  - PAD.left - PAD.right;
    const chartH = height - PAD.top  - PAD.bottom;

    const ratings  = data.map((d) => d.rating);
    const minR     = Math.min(...ratings) - 30;
    const maxR     = Math.max(...ratings) + 30;
    const rangeR   = maxR - minR || 1;

    // helpers
    const xOf = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const yOf = (r: number) => PAD.top  + chartH - ((r - minR) / rangeR) * chartH;

    // ── Grid lines ──────────────────────────────────────────────────────────
    const gridCount = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth   = 1;
    for (let i = 0; i <= gridCount; i++) {
      const y = PAD.top + (i / gridCount) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
    }

    // ── Y-axis labels ───────────────────────────────────────────────────────
    ctx.fillStyle  = "#666";
    ctx.font       = "10px sans-serif";
    ctx.textAlign  = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= gridCount; i++) {
      const val = minR + ((gridCount - i) / gridCount) * rangeR;
      const y   = PAD.top + (i / gridCount) * chartH;
      ctx.fillText(String(Math.round(val)), PAD.left - 6, y);
    }

    // ── Reference line at 1500 ───────────────────────────────────────────────
    if (minR <= 1500 && 1500 <= maxR) {
      const refY = yOf(1500);
      ctx.save();
      ctx.strokeStyle = "rgba(255,215,0,0.2)";
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, refY);
      ctx.lineTo(PAD.left + chartW, refY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle    = "#555";
      ctx.font         = "9px sans-serif";
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("1500", PAD.left + chartW + 2, refY);
      ctx.restore();
    }

    // ── Gradient fill under line ─────────────────────────────────────────────
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    grad.addColorStop(0,   "rgba(255,215,0,0.18)");
    grad.addColorStop(1,   "rgba(255,215,0,0)");
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(data[0].rating));
    data.forEach((d, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(d.rating)); });
    ctx.lineTo(xOf(data.length - 1), PAD.top + chartH);
    ctx.lineTo(xOf(0), PAD.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Line ──────────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(data[0].rating));
    data.forEach((d, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(d.rating)); });
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth   = 2;
    ctx.lineJoin    = "round";
    ctx.stroke();

    // ── Dots ──────────────────────────────────────────────────────────────
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(xOf(i), yOf(d.rating), 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.fill();
    });

    // ── X-axis labels (sparse) ────────────────────────────────────────────
    ctx.fillStyle    = "#666";
    ctx.font         = "10px sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    const maxLabels  = Math.floor(chartW / 52);
    const step       = Math.max(1, Math.ceil(data.length / maxLabels));
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        ctx.fillText(d.date, xOf(i), PAD.top + chartH + 6);
      }
    });

  }, [data, width, height]);

  // ── Mouse interaction ─────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || data.length === 0) return;
    const rect   = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartW = width - PAD.left - PAD.right;

    // Find nearest data point
    const idx = Math.round(
      ((mouseX - PAD.left) / chartW) * (data.length - 1)
    );
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    const d = data[clamped];

    const ratings  = data.map((d) => d.rating);
    const minR     = Math.min(...ratings) - 30;
    const maxR     = Math.max(...ratings) + 30;
    const rangeR   = maxR - minR || 1;
    const chartH   = height - PAD.top - PAD.bottom;

    const xOf = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const yOf = (r: number) => PAD.top  + chartH - ((r - minR) / rangeR) * chartH;

    setTooltip({
      visible: true,
      x: xOf(clamped),
      y: yOf(d.rating),
      rating: d.rating,
      change: d.change,
      date: d.date,
    });
  };

  const handleMouseLeave = () => setTooltip((t) => ({ ...t, visible: false }));

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!history || history.length === 0) {
    return (
      <div className="rating-chart-empty" style={{ height }}>
        Play games to see your rating history
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="rating-chart-wrapper" style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: "block", cursor: "crosshair" }}
      />

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="rating-chart-tooltip"
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y - 64,
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        >
          <div className="rct-rating">{tooltip.rating}</div>
          <div className={`rct-change ${tooltip.change >= 0 ? "pos" : "neg"}`}>
            {tooltip.change >= 0 ? "+" : ""}{Math.round(tooltip.change)}
          </div>
          <div className="rct-date">{tooltip.date}</div>
        </div>
      )}
    </div>
  );
};

export default RatingChart;