/**
 * MagDistance - Main Application Controller
 * UIインタラクション、Chart.js描画、2D Canvasアニメーション (ヨークビジュアル対応)、CSVエクスポート
 */

import {
  MAGNET_PRESETS,
  YOKE_TYPES,
  calculateSurfaceB,
  calculateBrFromSurfaceB,
  calculatePullForce,
  generateDistanceForceCurve,
  calculateAxialBField
} from './magnetics.js';

// グローバル状態
const state = {
  currentUnit: 'kgf',       // 'N', 'kgf', 'gf', 'lbf'
  isAttract: true,           // true: N-S吸引, false: N-N反発
  targetType: 'magnet',      // 'magnet', 'steel'
  isLogScale: false,
  chart: null,
  currentSliderGapMm: 0,
  calcResults: []
};

// DOM 要素キャッシュ
const elements = {
  // Unit & Mode Controls
  unitBtns: document.querySelectorAll('#unitControl .segmented-btn'),
  forceModeBtns: document.querySelectorAll('#forceModeControl .segmented-btn'),
  btnPresetN42: document.getElementById('btnPresetN42'),
  btnPresetCapYoke: document.getElementById('btnPresetCapYoke'),
  btnPresetSteel: document.getElementById('btnPresetSteel'),

  // Quick Stats
  statForce0: document.getElementById('statForce0'),
  unitStat0: document.getElementById('unitStat0'),
  statForce0N: document.getElementById('statForce0N'),
  statForce1: document.getElementById('statForce1'),
  unitStat1: document.getElementById('unitStat1'),
  statForce1N: document.getElementById('statForce1N'),
  statForce5: document.getElementById('statForce5'),
  unitStat5: document.getElementById('unitStat5'),
  statForce5N: document.getElementById('statForce5N'),
  statForce10: document.getElementById('statForce10'),
  unitStat10: document.getElementById('unitStat10'),
  statForce10N: document.getElementById('statForce10N'),

  // Magnet A Controls
  presetA: document.getElementById('presetA'),
  yokeA: document.getElementById('yokeA'),
  diaA: document.getElementById('diaA'),
  thickA: document.getElementById('thickA'),
  brA: document.getElementById('brA'),
  surfBA: document.getElementById('surfBA'),

  // Target / Magnet B Controls
  targetType: document.getElementById('targetType'),
  magnetBControls: document.getElementById('magnetBControls'),
  steelNotice: document.getElementById('steelNotice'),
  btnCopyAtoB: document.getElementById('btnCopyAtoB'),
  presetB: document.getElementById('presetB'),
  yokeB: document.getElementById('yokeB'),
  diaB: document.getElementById('diaB'),
  thickB: document.getElementById('thickB'),
  brB: document.getElementById('brB'),

  // Range Settings
  maxGap: document.getElementById('maxGap'),
  calcSteps: document.getElementById('calcSteps'),

  // Visualizer & Chart
  canvas: document.getElementById('visualizerCanvas'),
  slider: document.getElementById('distanceSlider'),
  sliderValue: document.getElementById('sliderValue'),
  liveForceDisplay: document.getElementById('liveForceDisplay'),
  chartCanvas: document.getElementById('pullForceChart'),
  btnToggleLog: document.getElementById('btnToggleLog'),
  btnExportCSV: document.getElementById('btnExportCSV'),
  tableBody: document.getElementById('tableBody'),
  toast: document.getElementById('toast')
};

/**
 * 初期化関数
 */
function initApp() {
  setupEventListeners();
  updateSurfaceBDisplay('A');
  updateSurfaceBDisplay('B');
  initChart();
  recalculateAll();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

/**
 * イベントリスナーの登録
 */
function setupEventListeners() {
  // 単位切り替え
  elements.unitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.unitBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentUnit = btn.dataset.unit;
      updateUnitLabels();
      renderResults();
    });
  });

  // 作用モード切り替え
  elements.forceModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.forceModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.isAttract = btn.dataset.attract === 'true';
      recalculateAll();
    });
  });

  // プリセットショートカット
  elements.btnPresetN42.addEventListener('click', () => {
    setPreset('A', 'N42');
    setPreset('B', 'N42');
    elements.yokeA.value = 'none';
    elements.yokeB.value = 'none';
    recalculateAll();
    showToast('標準 ネオジム N42 (ヨークなし) をセットしました');
  });

  elements.btnPresetCapYoke.addEventListener('click', () => {
    setPreset('A', 'N42');
    elements.yokeA.value = 'cup';
    elements.targetType.value = 'steel';
    toggleTargetTypeUI();
    recalculateAll();
    showToast('キャップヨーク付磁石 vs 鉄板 モードをセットしました');
  });

  elements.btnPresetSteel.addEventListener('click', () => {
    elements.targetType.value = 'steel';
    toggleTargetTypeUI();
    recalculateAll();
    showToast('対鉄板（スチールプレート）モードに切り替えました');
  });

  // 磁石A 入力変更
  elements.presetA.addEventListener('change', () => { setPreset('A', elements.presetA.value); });
  elements.yokeA.addEventListener('change', () => { updateSurfaceBDisplay('A'); recalculateAll(); });
  elements.diaA.addEventListener('input', () => { updateSurfaceBDisplay('A'); recalculateAll(); });
  elements.thickA.addEventListener('input', () => { updateSurfaceBDisplay('A'); recalculateAll(); });
  elements.brA.addEventListener('input', () => {
    elements.presetA.value = 'custom';
    updateSurfaceBDisplay('A');
    recalculateAll();
  });

  // 対象物種類切り替え
  elements.targetType.addEventListener('change', () => {
    toggleTargetTypeUI();
    recalculateAll();
  });

  // 磁石B コピーボタン
  elements.btnCopyAtoB.addEventListener('click', () => {
    elements.diaB.value = elements.diaA.value;
    elements.thickB.value = elements.thickA.value;
    elements.brB.value = elements.brA.value;
    elements.presetB.value = elements.presetA.value;
    elements.yokeB.value = elements.yokeA.value;
    updateSurfaceBDisplay('B');
    recalculateAll();
    showToast('磁石Aの仕様を磁石Bにコピーしました');
  });

  // 磁石B 入力変更
  elements.presetB.addEventListener('change', () => { setPreset('B', elements.presetB.value); });
  elements.yokeB.addEventListener('change', () => { updateSurfaceBDisplay('B'); recalculateAll(); });
  elements.diaB.addEventListener('input', () => { updateSurfaceBDisplay('B'); recalculateAll(); });
  elements.thickB.addEventListener('input', () => { updateSurfaceBDisplay('B'); recalculateAll(); });
  elements.brB.addEventListener('input', () => {
    elements.presetB.value = 'custom';
    updateSurfaceBDisplay('B');
    recalculateAll();
  });

  // 距離設定変更
  elements.maxGap.addEventListener('input', () => {
    const maxVal = parseFloat(elements.maxGap.value) || 30;
    elements.slider.max = maxVal;
    recalculateAll();
  });
  elements.calcSteps.addEventListener('change', recalculateAll);

  // 離隔距離スライダー
  elements.slider.addEventListener('input', (e) => {
    state.currentSliderGapMm = parseFloat(e.target.value);
    elements.sliderValue.textContent = state.currentSliderGapMm.toFixed(1);
    drawVisualizer();
    updateLiveForceDisplay();
  });

  // グラフオプション
  elements.btnToggleLog.addEventListener('click', () => {
    state.isLogScale = !state.isLogScale;
    elements.btnToggleLog.textContent = `対数表示: ${state.isLogScale ? 'ON' : 'OFF'}`;
    elements.btnToggleLog.classList.toggle('active', state.isLogScale);
    updateChart();
  });

  elements.btnExportCSV.addEventListener('click', exportCSV);
}

/**
 * プリセット値をセット
 */
function setPreset(target, presetKey) {
  const p = MAGNET_PRESETS[presetKey];
  if (!p) return;

  if (target === 'A') {
    elements.presetA.value = presetKey;
    if (presetKey !== 'custom') elements.brA.value = Math.round(p.Br * 1000);
    updateSurfaceBDisplay('A');
  } else {
    elements.presetB.value = presetKey;
    if (presetKey !== 'custom') elements.brB.value = Math.round(p.Br * 1000);
    updateSurfaceBDisplay('B');
  }
  recalculateAll();
}

/**
 * 表面中心磁束密度の更新表示
 */
function updateSurfaceBDisplay(target) {
  if (target === 'A') {
    const r = (parseFloat(elements.diaA.value) || 20) / 2000;
    const t = (parseFloat(elements.thickA.value) || 5) / 1000;
    const Br = (parseFloat(elements.brA.value) || 1320) / 1000;
    const yoke = elements.yokeA.value;
    const Bsurf = calculateSurfaceB(r, t, Br, yoke);
    elements.surfBA.value = Math.round(Bsurf * 1000);
  }
}

/**
 * UIの切り替え（磁石B vs 鉄板）
 */
function toggleTargetTypeUI() {
  state.targetType = elements.targetType.value;
  if (state.targetType === 'steel') {
    elements.magnetBControls.style.display = 'none';
    elements.steelNotice.style.display = 'block';
  } else {
    elements.magnetBControls.style.display = 'block';
    elements.steelNotice.style.display = 'none';
  }
}

/**
 * 現在の力単位ラベルの更新
 */
function updateUnitLabels() {
  const u = state.currentUnit;
  elements.unitStat0.textContent = u;
  elements.unitStat1.textContent = u;
  elements.unitStat5.textContent = u;
  elements.unitStat10.textContent = u;
}

/**
 * 全計算の実行とUI更新
 */
function recalculateAll() {
  const config = getConfigFromInputs();

  const maxGapM = (parseFloat(elements.maxGap.value) || 30) / 1000;
  const steps = parseInt(elements.calcSteps.value, 10) || 60;

  state.calcResults = generateDistanceForceCurve(config, 0, maxGapM, steps);

  renderResults();
  drawVisualizer();
}

/**
 * 入力要素から計算設定オブジェクトを構築
 */
function getConfigFromInputs() {
  const diaA_m = (parseFloat(elements.diaA.value) || 20) / 1000;
  const thickA_m = (parseFloat(elements.thickA.value) || 5) / 1000;
  const brA_T = (parseFloat(elements.brA.value) || 1320) / 1000;
  const yokeA = elements.yokeA.value;

  const diaB_m = (parseFloat(elements.diaB.value) || 20) / 1000;
  const thickB_m = (parseFloat(elements.thickB.value) || 5) / 1000;
  const brB_T = (parseFloat(elements.brB.value) || 1320) / 1000;
  const yokeB = elements.yokeB.value;

  return {
    radiusA: diaA_m / 2,
    thicknessA: thickA_m,
    BrA: brA_T,
    yokeA: yokeA,
    targetType: state.targetType,
    radiusB: diaB_m / 2,
    thicknessB: thickB_m,
    BrB: brB_T,
    yokeB: yokeB,
    isAttract: state.isAttract
  };
}

/**
 * 結果のレンダリング
 */
function renderResults() {
  if (!state.calcResults || state.calcResults.length === 0) return;

  const config = getConfigFromInputs();

  const f0 = calculatePullForce({ ...config, gap: 0 });
  const f1 = calculatePullForce({ ...config, gap: 0.001 });
  const f5 = calculatePullForce({ ...config, gap: 0.005 });
  const f10 = calculatePullForce({ ...config, gap: 0.010 });

  const getForceVal = (res) => {
    switch (state.currentUnit) {
      case 'N': return res.forceN.toFixed(2);
      case 'kgf': return res.forceKgf.toFixed(2);
      case 'gf': return res.forceGf.toFixed(0);
      case 'lbf': return res.forceLbf.toFixed(2);
      default: return res.forceKgf.toFixed(2);
    }
  };

  const getSubValStr = (res) => {
    return state.currentUnit === 'N'
      ? `${res.forceKgf.toFixed(2)} kgf`
      : `${res.forceN.toFixed(1)} N`;
  };

  elements.statForce0.textContent = getForceVal(f0);
  elements.statForce0N.textContent = getSubValStr(f0);

  elements.statForce1.textContent = getForceVal(f1);
  elements.statForce1N.textContent = getSubValStr(f1);

  elements.statForce5.textContent = getForceVal(f5);
  elements.statForce5N.textContent = getSubValStr(f5);

  elements.statForce10.textContent = getForceVal(f10);
  elements.statForce10N.textContent = getSubValStr(f10);

  renderDataTable();
  updateChart();
  updateLiveForceDisplay();
}

/**
 * データテーブルの生成
 */
function renderDataTable() {
  const config = getConfigFromInputs();
  let html = '';

  state.calcResults.forEach(item => {
    const gapM = item.gapM;
    const Bz = calculateAxialBField(config.radiusA, config.thicknessA, config.BrA, gapM, config.yokeA);

    html += `
      <tr>
        <td style="text-align: center; font-weight: 500;">${item.gapMm.toFixed(2)}</td>
        <td>${item.forceN.toFixed(2)}</td>
        <td>${item.forceKgf.toFixed(3)}</td>
        <td>${item.forceGf.toFixed(1)}</td>
        <td>${Bz.toFixed(1)}</td>
      </tr>
    `;
  });

  elements.tableBody.innerHTML = html;
}

/**
 * Chart.js グラフの初期化
 */
function initChart() {
  const ctx = elements.chartCanvas.getContext('2d');
  
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '吸着力',
        data: [],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#06b6d4'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#06b6d4',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(6, 182, 212, 0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => `離隔距離: ${items[0].label} mm`,
            label: (item) => `吸着力: ${item.formattedValue} ${state.currentUnit}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '離隔距離 (mm)', color: '#94a3b8', font: { size: 12, weight: 'bold' } },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          title: { display: true, text: `吸着力 (${state.currentUnit})`, color: '#06b6d4', font: { size: 12, weight: 'bold' } },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
          type: 'linear',
          min: 0
        }
      }
    }
  });
}

/**
 * Chart.js データ更新
 */
function updateChart() {
  if (!state.chart || !state.calcResults) return;

  const labels = state.calcResults.map(d => d.gapMm.toFixed(1));
  const dataVals = state.calcResults.map(d => {
    switch (state.currentUnit) {
      case 'N': return d.forceN;
      case 'kgf': return d.forceKgf;
      case 'gf': return d.forceGf;
      case 'lbf': return d.forceLbf;
      default: return d.forceKgf;
    }
  });

  state.chart.data.labels = labels;
  state.chart.data.datasets[0].data = dataVals;
  state.chart.data.datasets[0].label = `吸着力 (${state.currentUnit})`;

  state.chart.options.scales.y.type = state.isLogScale ? 'logarithmic' : 'linear';
  state.chart.options.scales.y.min = state.isLogScale ? undefined : 0;
  state.chart.options.scales.y.title.text = `吸着力 (${state.currentUnit})`;

  state.chart.update('none');
}

/**
 * 2D Canvas 解像度調整
 */
function resizeCanvas() {
  const canvas = elements.canvas;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  drawVisualizer();
}

/**
 * 2D Visualizer Canvas のアニメーション描画 (ヨーク対応)
 */
function drawVisualizer() {
  const canvas = elements.canvas;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const diaA_mm = parseFloat(elements.diaA.value) || 20;
  const thickA_mm = parseFloat(elements.thickA.value) || 5;
  const yokeA = elements.yokeA.value;
  const gap_mm = state.currentSliderGapMm;

  let diaB_mm = diaA_mm;
  let thickB_mm = thickA_mm;
  let yokeB = 'none';

  if (state.targetType === 'magnet') {
    diaB_mm = parseFloat(elements.diaB.value) || 20;
    thickB_mm = parseFloat(elements.thickB.value) || 5;
    yokeB = elements.yokeB.value;
  } else {
    diaB_mm = diaA_mm * 1.5;
    thickB_mm = 6;
  }

  const scale = Math.min(w / 130, h / 85);
  const centerY = h / 2;

  const thickA_px = Math.max(10, thickA_mm * scale);
  const diaA_px = Math.max(16, diaA_mm * scale);

  const thickB_px = Math.max(10, thickB_mm * scale);
  const diaB_px = Math.max(16, diaB_mm * scale);

  const gap_px = gap_mm * scale;

  const totalWidth_px = thickA_px + gap_px + thickB_px;
  const startX = (w - totalWidth_px) / 2;

  const xA = startX;
  const yA = centerY - diaA_px / 2; // 磁石A (完全に中心軸で平行)

  const xB = startX + thickA_px + gap_px;
  const yB = centerY - diaB_px / 2; // 磁石B / 鉄板 (完全に中心軸で平行)

  // 1. 磁極線の描画 (同軸平行な対抗面間の磁力線)
  if (gap_mm < 35) {
    ctx.save();
    const lineCount = (yokeA !== 'none' || yokeB !== 'none') ? 9 : 6;
    const maxGapAlpha = Math.max(0.12, 1 - (gap_mm / 35));

    for (let i = 0; i < lineCount; i++) {
      const offsetFactor = (i / (lineCount - 1)) - 0.5;
      const y1 = centerY + offsetFactor * (diaA_px * 0.85);
      const y2 = centerY + offsetFactor * (diaB_px * 0.85);

      const midX = (xA + thickA_px + xB) / 2;
      const curveHeight = state.isAttract ? 0 : offsetFactor * gap_px * 1.2;

      ctx.beginPath();
      ctx.moveTo(xA + thickA_px, y1);
      ctx.quadraticCurveTo(midX, centerY + curveHeight, xB, y2);

      const strokeColor = state.isAttract ? 'rgba(6, 182, 212, ' : 'rgba(239, 68, 68, ';
      ctx.strokeStyle = `${strokeColor}${maxGapAlpha})`;
      ctx.lineWidth = (yokeA !== 'none' ? 2.5 : 1.8) * window.devicePixelRatio;
      ctx.setLineDash(state.isAttract ? [] : [4, 4]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. 磁石 A の描画 (ラベル文字は上方にオフセット)
  drawMagnetWithYoke(ctx, xA, yA, thickA_px, diaA_px, 'N', 'S', '🔴 磁石 A', yokeA, 'left', 'top');

  // 3. 磁石 B または 鉄板の描画 (ラベル文字は下方にオフセット)
  if (state.targetType === 'magnet') {
    const northPole = state.isAttract ? 'S' : 'N';
    const southPole = state.isAttract ? 'N' : 'S';
    drawMagnetWithYoke(ctx, xB, yB, thickB_px, diaB_px, northPole, southPole, '🔵 磁石 B', yokeB, 'right', 'bottom');
  } else {
    drawSteelPlate(ctx, xB, yB, thickB_px, diaB_px, '⚙️ 鉄板', 'bottom');
  }

  // 4. 離隔距離の寸法ガイド線表示 (中心上部に配置)
  ctx.save();
  ctx.strokeStyle = '#06b6d4';
  ctx.fillStyle = '#06b6d4';
  ctx.lineWidth = 1.5 * window.devicePixelRatio;
  ctx.font = `${11 * window.devicePixelRatio}px Inter, sans-serif`;
  ctx.textAlign = 'center';

  const lineY = centerY - Math.max(diaA_px, diaB_px) / 2 - 22 * window.devicePixelRatio;
  
  ctx.beginPath();
  ctx.moveTo(xA + thickA_px, lineY);
  ctx.lineTo(xB, lineY);
  ctx.stroke();

  // 端部縦目盛り線
  ctx.beginPath();
  ctx.moveTo(xA + thickA_px, lineY - 4 * window.devicePixelRatio);
  ctx.lineTo(xA + thickA_px, lineY + 4 * window.devicePixelRatio);
  ctx.moveTo(xB, lineY - 4 * window.devicePixelRatio);
  ctx.lineTo(xB, lineY + 4 * window.devicePixelRatio);
  ctx.stroke();

  ctx.fillText(`${gap_mm.toFixed(1)} mm`, (xA + thickA_px + xB) / 2, lineY - 6 * window.devicePixelRatio);
  ctx.restore();
}

/**
 * ヨーク付き磁石描画関数
 */
function drawMagnetWithYoke(ctx, x, y, width, height, leftPole, rightPole, label, yokeType, align = 'left', labelPos = 'top') {
  ctx.save();
  const radius = 6 * window.devicePixelRatio;
  const yokeThick = 4 * window.devicePixelRatio;

  // 1. ヨーク（鉄板ケース）の描画
  if (yokeType === 'back') {
    const yokeX = (align === 'left') ? x - yokeThick : x + width;
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(yokeX, y - 2, yokeThick, height + 4, 3);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
  } else if (yokeType === 'cup') {
    ctx.fillStyle = '#475569';
    if (align === 'left') {
      ctx.beginPath();
      ctx.roundRect(x - yokeThick, y - yokeThick, width + yokeThick, height + yokeThick * 2, [radius, 0, 0, radius]);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y - yokeThick, width + yokeThick, height + yokeThick * 2, [0, radius, radius, 0]);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();
    }
  }

  // 2. N極・S極 磁石本体
  ctx.fillStyle = leftPole === 'N' ? '#ef4444' : '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(x, y, width / 2, height, [radius, 0, 0, radius]);
  ctx.fill();

  ctx.fillStyle = rightPole === 'S' ? '#3b82f6' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(x + width / 2, y, width / 2, height, [0, radius, radius, 0]);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5 * window.devicePixelRatio;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${10 * window.devicePixelRatio}px Inter`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(leftPole, x + width * 0.25, y + height / 2);
  ctx.fillText(rightPole, x + width * 0.75, y + height / 2);

  // ヨーク注記ラベル (磁石A: 上方 / 磁石B: 下方に完全分離)
  let displayLabel = label;
  if (yokeType === 'back') displayLabel += ' (背面ヨーク)';
  if (yokeType === 'cup') displayLabel += ' (キャップヨーク)';

  ctx.fillStyle = '#94a3b8';
  ctx.font = `${10 * window.devicePixelRatio}px Inter`;
  
  if (labelPos === 'top') {
    const labelY = y - (yokeType === 'cup' ? yokeThick + 12 : 12) * window.devicePixelRatio;
    ctx.fillText(displayLabel, x + width / 2, labelY);
  } else {
    const labelY = y + height + (yokeType === 'cup' ? yokeThick + 16 : 16) * window.devicePixelRatio;
    ctx.fillText(displayLabel, x + width / 2, labelY);
  }

  ctx.restore();
}

/**
 * 鉄板描画
 */
function drawSteelPlate(ctx, x, y, width, height, label, labelPos = 'bottom') {
  ctx.save();
  const radius = 4 * window.devicePixelRatio;

  const grad = ctx.createLinearGradient(x, y, x + width, y);
  grad.addColorStop(0, '#64748b');
  grad.addColorStop(0.5, '#94a3b8');
  grad.addColorStop(1, '#475569');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5 * window.devicePixelRatio;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = `${10 * window.devicePixelRatio}px Inter`;
  ctx.textAlign = 'center';

  if (labelPos === 'top') {
    ctx.fillText(label, x + width / 2, y - 12 * window.devicePixelRatio);
  } else {
    ctx.fillText(label, x + width / 2, y + height + 16 * window.devicePixelRatio);
  }

  ctx.restore();
}

/**
 * リアルタイム表示更新
 */
function updateLiveForceDisplay() {
  const config = getConfigFromInputs();
  const gapM = state.currentSliderGapMm / 1000;
  const res = calculatePullForce({ ...config, gap: gapM });

  let valStr = '';
  switch (state.currentUnit) {
    case 'N': valStr = `${res.forceN.toFixed(2)} N`; break;
    case 'kgf': valStr = `${res.forceKgf.toFixed(2)} kgf`; break;
    case 'gf': valStr = `${res.forceGf.toFixed(0)} gf`; break;
    case 'lbf': valStr = `${res.forceLbf.toFixed(2)} lbf`; break;
  }

  elements.liveForceDisplay.textContent = `距離 ${state.currentSliderGapMm.toFixed(1)}mm の吸着力: ${valStr}`;
}

/**
 * CSV エクスポート
 */
function exportCSV() {
  if (!state.calcResults || state.calcResults.length === 0) return;

  const config = getConfigFromInputs();
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Distance(mm),Force(N),Force(kgf),Force(gf),Force(lbf),AxialField_Bz(mT)\n";

  state.calcResults.forEach(item => {
    const Bz = calculateAxialBField(config.radiusA, config.thicknessA, config.BrA, item.gapM, config.yokeA);
    csvContent += `${item.gapMm.toFixed(2)},${item.forceN.toFixed(4)},${item.forceKgf.toFixed(4)},${item.forceGf.toFixed(2)},${item.forceLbf.toFixed(4)},${Bz.toFixed(2)}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `MagDistance_PullForce_Data.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('📊 CSVファイルを出力・ダウンロードしました');
}

/**
 * トースト表示
 */
function showToast(msg) {
  elements.toast.textContent = msg;
  elements.toast.classList.add('show');
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

document.addEventListener('DOMContentLoaded', initApp);
