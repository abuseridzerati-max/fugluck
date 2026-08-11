import { VIRTUAL_VIEWPORT } from "@arcadeclash/shared";
import { PALETTE, TRIVIA_RULES } from "./constants";
import type { SpeedTriviaEngine } from "./engine";

export function renderSpeedTrivia(ctx: CanvasRenderingContext2D, engine: SpeedTriviaEngine) {
  const w = VIRTUAL_VIEWPORT.width;
  const h = VIRTUAL_VIEWPORT.height;

  // 1. Background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);

  // 2. Draw Top Bar (Header & Score)
  ctx.fillStyle = PALETTE.cardBg;
  ctx.fillRect(0, 0, w, 80);
  ctx.strokeStyle = PALETTE.cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 80);
  ctx.lineTo(w, 80);
  ctx.stroke();

  ctx.fillStyle = PALETTE.text;
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SPEED TRIVIA CLASH", 30, 48);

  ctx.fillStyle = PALETTE.accent;
  ctx.font = "bold 26px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`SCORE: ${engine.score}`, w - 30, 48);

  const q = engine.currentQuestion();
  if (!q || engine.gameOver) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", w / 2, h / 2 - 20);
    ctx.font = "bold 30px monospace";
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(`FINAL SCORE: ${engine.score}`, w / 2, h / 2 + 30);
    return;
  }

  // 3. Question Metadata Badge & Counter
  const qNumText = `QUESTION ${engine.currentQuestionIndex + 1} / ${TRIVIA_RULES.totalQuestions}`;
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = PALETTE.secondary;
  ctx.textAlign = "left";
  ctx.fillText(qNumText, 60, 130);

  // Category Badge
  ctx.fillStyle = PALETTE.primary;
  ctx.fillRect(w - 220, 108, 160, 32);
  ctx.fillStyle = PALETTE.text;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(q.category, w - 140, 129);

  // 4. Timer Bar
  const timerFraction = Math.max(0, engine.questionTicksRemaining / TRIVIA_RULES.ticksPerQuestion);
  const barWidth = w - 120;
  ctx.fillStyle = PALETTE.cardBg;
  ctx.fillRect(60, 150, barWidth, 12);
  ctx.fillStyle = timerFraction > 0.3 ? PALETTE.secondary : PALETTE.danger;
  ctx.fillRect(60, 150, barWidth * timerFraction, 12);

  // 5. Question Prompt Box
  ctx.fillStyle = PALETTE.cardBg;
  ctx.strokeStyle = PALETTE.cardBorder;
  ctx.fillRect(60, 185, w - 120, 160);
  ctx.strokeRect(60, 185, w - 120, 160);

  ctx.fillStyle = PALETTE.text;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  wrapText(ctx, q.question, w / 2, 255, w - 180, 38);

  // 6. Option Cards (2x2 Grid)
  const cardW = (w - 150) / 2; // 565px
  const cardH = 130;
  const positions = [
    { x: 60, y: 375 },
    { x: 60 + cardW + 30, y: 375 },
    { x: 60, y: 375 + cardH + 20 },
    { x: 60 + cardW + 30, y: 375 + cardH + 20 },
  ];

  const keys = ["A", "B", "C", "D"];

  for (let i = 0; i < 4; i++) {
    const pos = positions[i];
    let fillStyle: string = PALETTE.cardBg;
    let borderStyle: string = PALETTE.cardBorder;

    if (engine.selectedAnswer !== null) {
      if (i === q.correctIndex) {
        fillStyle = "#064e3b"; // Highlight correct option green
        borderStyle = PALETTE.success;
      } else if (i === engine.selectedAnswer) {
        fillStyle = "#7f1d1d"; // Highlight wrong selection red
        borderStyle = PALETTE.danger;
      }
    }

    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 3;
    ctx.fillRect(pos.x, pos.y, cardW, cardH);
    ctx.strokeRect(pos.x, pos.y, cardW, cardH);

    // Key badge [A], [B], [C], [D]
    ctx.fillStyle = PALETTE.secondary;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`[${keys[i]}]`, pos.x + 20, pos.y + 35);

    // Option Text
    ctx.fillStyle = PALETTE.text;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    wrapText(ctx, q.options[i], pos.x + cardW / 2, pos.y + 75, cardW - 60, 28);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (!ctx.measureText) {
    ctx.fillText(text, x, y);
    return;
  }
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
