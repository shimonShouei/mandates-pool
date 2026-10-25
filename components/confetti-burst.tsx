"use client";

import { useEffect } from "react";

const COLORS = ["#ff4d8d", "#7c5cff", "#d6ff4a", "#3dd6c6", "#ffb020", "#ffffff"];

export function ConfettiBurst({ fire }: { fire: boolean }) {
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "60";
    document.body.appendChild(canvas);
    const context = canvas.getContext("2d");
    if (!context) {
      canvas.remove();
      return;
    }
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    const pieces = Array.from({ length: 90 }, (_, index) => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 10 - 4,
      size: 6 + Math.random() * 6,
      color: COLORS[index % COLORS.length],
      spin: Math.random() * 0.3,
      angle: Math.random() * Math.PI,
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame += 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const piece of pieces) {
        piece.vy += 0.28;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }
      if (frame < 80) raf = window.requestAnimationFrame(tick);
      else canvas.remove();
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, [fire]);

  return null;
}
