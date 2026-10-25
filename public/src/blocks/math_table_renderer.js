// Interactive Data Tables & Mathematical Function Plot Rendering Engine
import { FunctionPlotter } from './plot_block.js';

export function renderTableItem(parentEl, item, containerBlock, deps = {}) {
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;
  const renderAll = deps.renderAll || window.renderAll;

  const tableDiv = document.createElement('div');
  tableDiv.style.overflowX = 'auto';

  const rows = item.data || [
    ['Col 1', 'Col 2', 'Col 3'],
    ['Val 1', 'Val 2', 'Val 3']
  ];

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '4px';
  controls.style.marginBottom = '6px';
  controls.innerHTML = `
    <button class="tbl-btn-row mini-tool-btn">+ Row</button>
    <button class="tbl-btn-col mini-tool-btn">+ Column</button>
  `;

  controls.querySelector('.tbl-btn-row').addEventListener('click', (e) => {
    e.stopPropagation();
    const cols = rows[0] ? rows[0].length : 3;
    rows.push(new Array(cols).fill(''));
    item.data = rows;
    if (saveActivePageDocument) saveActivePageDocument();
    if (renderAll) renderAll();
  });

  controls.querySelector('.tbl-btn-col').addEventListener('click', (e) => {
    e.stopPropagation();
    rows.forEach((r, idx) => r.push(idx === 0 ? `Header ${r.length + 1}` : ''));
    item.data = rows;
    if (saveActivePageDocument) saveActivePageDocument();
    if (renderAll) renderAll();
  });

  tableDiv.appendChild(controls);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  rows.forEach((row, rIdx) => {
    const tr = document.createElement('tr');
    row.forEach((cell, cIdx) => {
      const td = document.createElement(rIdx === 0 ? 'th' : 'td');
      td.contentEditable = 'true';
      td.textContent = cell;
      td.style.border = '1px solid var(--border-color, #cbd5e1)';
      td.style.padding = '6px 10px';
      td.style.background = rIdx === 0 ? 'var(--panel-sub, #f8fafc)' : 'var(--card-bg, #ffffff)';
      td.style.color = 'var(--text-main, #1e293b)';
      td.style.fontWeight = rIdx === 0 ? '600' : 'normal';

      td.addEventListener('input', () => {
        rows[rIdx][cIdx] = td.textContent;
        item.data = rows;
        if (saveActivePageDocument) saveActivePageDocument();
      });
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  tableDiv.appendChild(table);
  parentEl.appendChild(tableDiv);
}

export function renderPlotItem(parentEl, item, containerBlock, deps = {}) {
  const saveActivePageDocument = deps.saveActivePageDocument || window.saveActivePageDocument;

  const plotDiv = document.createElement('div');
  plotDiv.style.border = '1px solid #e2e8f0';
  plotDiv.style.borderRadius = '6px';
  plotDiv.style.overflow = 'hidden';

  const formula = item.formula || 'sin(x)';

  plotDiv.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; padding:6px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <span style="font-size:13px; font-weight:700; color:#475569;">y =</span>
      <input type="text" class="plot-input" value="${formula}" style="flex:1; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-family:monospace; font-size:13px;">
      <button class="mini-tool-btn btn-plot-run" style="background:#4f46e5; color:#fff; border:none; padding:4px 10px;">Plot</button>
    </div>
    <canvas class="plot-canvas" width="480" height="220" style="width:100%; height:220px; display:block; background:#fff;"></canvas>
  `;

  const input = plotDiv.querySelector('.plot-input');
  const btn = plotDiv.querySelector('.btn-plot-run');
  const canvas = plotDiv.querySelector('.plot-canvas');

  const plotAction = () => {
    item.formula = input.value;
    drawPlot(canvas, item.formula, item.xMin ?? -10, item.xMax ?? 10);
    if (saveActivePageDocument) saveActivePageDocument();
  };

  btn.addEventListener('click', plotAction);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') plotAction(); });

  parentEl.appendChild(plotDiv);
  setTimeout(() => drawPlot(canvas, formula, item.xMin ?? -10, item.xMax ?? 10), 10);
}

export function drawPlot(canvas, expr, xMin = -10, xMax = 10) {
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  g.clearRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);

  const points = FunctionPlotter.generatePlotPoints(expr, xMin, xMax, 300);
  const validY = points.filter(p => p.y !== null).map(p => p.y);
  const yMin = validY.length ? Math.min(-2, Math.min(...validY)) : -5;
  const yMax = validY.length ? Math.max(2, Math.max(...validY)) : 5;

  const toScreenX = (x) => ((x - xMin) / (xMax - xMin)) * w;
  const toScreenY = (y) => h - ((y - yMin) / (yMax - yMin)) * h;

  // Grid
  g.strokeStyle = '#f1f5f9';
  g.lineWidth = 1;
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += 2) {
    g.beginPath(); g.moveTo(toScreenX(x), 0); g.lineTo(toScreenX(x), h); g.stroke();
  }

  // Axes
  g.strokeStyle = '#94a3b8';
  g.lineWidth = 1.5;
  if (yMin <= 0 && yMax >= 0) {
    const y0 = toScreenY(0);
    g.beginPath(); g.moveTo(0, y0); g.lineTo(w, y0); g.stroke();
  }
  if (xMin <= 0 && xMax >= 0) {
    const x0 = toScreenX(0);
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, h); g.stroke();
  }

  // Curve
  g.strokeStyle = '#4f46e5';
  g.lineWidth = 2.5;
  g.beginPath();
  let started = false;
  points.forEach(p => {
    if (p.y === null) {
      started = false;
    } else {
      const sx = toScreenX(p.x);
      const sy = toScreenY(p.y);
      if (!started) {
        g.moveTo(sx, sy);
        started = true;
      } else {
        g.lineTo(sx, sy);
      }
    }
  });
  g.stroke();
}
