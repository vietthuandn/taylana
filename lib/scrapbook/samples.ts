"use client";
// ảnh thử: dải màu có số để nhận ra ô nào là ảnh nào
export function samplePhotos() {
  const hues = [340, 20, 45, 150, 200, 260, 300, 100, 180, 0];
  return hues.map((h, i) => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 480;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 600, 480);
    g.addColorStop(0, `hsl(${h} 70% 78%)`); g.addColorStop(1, `hsl(${(h + 40) % 360} 65% 58%)`);
    x.fillStyle = g; x.fillRect(0, 0, 600, 480);
    x.fillStyle = "rgba(255,255,255,0.35)"; x.beginPath(); x.arc(420, 140, 90, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#ffffff"; x.font = "700 200px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(i + 1), 300, 260);
    return c;
  });
}

