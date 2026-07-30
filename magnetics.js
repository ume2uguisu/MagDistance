/**
 * MagDistance - Physics Calculation Engine for Magnet Pull Force & Magnetic Fields
 * 磁石間・磁石鉄板間の吸着力および磁界プロファイル計算エンジン
 */

// 物理定数
export const MU_0 = 4 * Math.PI * 1e-7; // 真空の透磁率 [H/m or N/A^2]

/**
 * 主要な磁石材料のプリセット定義
 * Br: 残留磁束密度 [Tesla]
 */
export const MAGNET_PRESETS = {
  'N52': { name: 'ネオジム N52 (最高磁力)', Br: 1.45, tempMax: 80, type: 'neodymium' },
  'N48': { name: 'ネオジム N48', Br: 1.40, tempMax: 80, type: 'neodymium' },
  'N42': { name: 'ネオジム N42 (標準的)', Br: 1.32, tempMax: 80, type: 'neodymium' },
  'N35': { name: 'ネオジム N35 (普及品)', Br: 1.18, tempMax: 80, type: 'neodymium' },
  'N42SH': { name: 'ネオジム N42SH (耐熱150℃)', Br: 1.30, tempMax: 150, type: 'neodymium' },
  'SmCo28': { name: 'サマコバ Sm2Co17 (耐熱300℃)', Br: 1.05, tempMax: 300, type: 'samarium' },
  'FerriteC8': { name: 'フェライト C8 (異方性)', Br: 0.39, tempMax: 250, type: 'ferrite' },
  'AlNiCo5': { name: 'アルニコ 5', Br: 1.25, tempMax: 500, type: 'alnico' },
  'custom': { name: 'カスタム（直接入力）', Br: 1.30, tempMax: 100, type: 'custom' }
};

/**
 * 円柱磁石の表面中心における磁束密度 B_center [T] を算出
 */
export function calculateSurfaceB(radius, thickness, Br) {
  if (radius <= 0 || thickness <= 0 || Br <= 0) return 0;
  return (Br / 2) * (thickness / Math.sqrt(radius * radius + thickness * thickness));
}

/**
 * 表面中心磁束密度 B_center から残留磁束密度 Br [T] を逆算
 */
export function calculateBrFromSurfaceB(radius, thickness, Bcenter) {
  if (radius <= 0 || thickness <= 0 || Bcenter <= 0) return 0;
  return 2 * Bcenter * (Math.sqrt(radius * radius + thickness * thickness) / thickness);
}

/**
 * Gauss-Legendre 8点積分のノードと重み ([-1, 1] 区間)
 */
const GAUSS_NODES = [
  -0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
   0.1834346424956498,  0.5255324099163290,  0.7966664774136267,  0.9602898564975363
];
const GAUSS_WEIGHTS = [
   0.1012285362903763,  0.2223810344533745,  0.3137066458778873,  0.3626837833783620,
   0.3626837833783620,  0.3137066458778873,  0.2223810344533745,  0.1012285362903763
];

/**
 * 2つの平行同軸円盤間の面荷相互作用力 F_pair(d) [N]
 */
function calculateDiskPairForce(R1, R2, d, Br1, Br2) {
  const dist = Math.max(1e-6, d);
  const factor = (Br1 * Br2) / (4 * Math.PI * MU_0);

  let sum = 0;
  const halfR1 = R1 / 2;
  const halfR2 = R2 / 2;
  const halfPi = Math.PI / 2;

  for (let i = 0; i < 8; i++) {
    const u1 = GAUSS_NODES[i];
    const w1 = GAUSS_WEIGHTS[i];
    const r1 = halfR1 * (u1 + 1);

    for (let j = 0; j < 8; j++) {
      const u2 = GAUSS_NODES[j];
      const w2 = GAUSS_WEIGHTS[j];
      const r2 = halfR2 * (u2 + 1);

      for (let k = 0; k < 8; k++) {
        const u3 = GAUSS_NODES[k];
        const w3 = GAUSS_WEIGHTS[k];
        const theta = halfPi * (u3 + 1);
        const cosTheta = Math.cos(theta);

        const distSq = r1 * r1 + r2 * r2 - 2 * r1 * r2 * cosTheta + dist * dist;
        const denom = Math.pow(distSq, 1.5);

        const integrand = (r1 * r2 * dist) / denom;
        sum += w1 * w2 * w3 * integrand;
      }
    }
  }

  const jacobian = halfR1 * halfR2 * halfPi * (2 * Math.PI);
  return factor * sum * jacobian;
}

/**
 * 2つの磁石間、または磁石と鉄板間の吸着力 F(z) [N] を計算
 */
export function calculatePullForce(config) {
  const {
    radiusA,
    thicknessA,
    BrA,
    targetType = 'magnet',
    radiusB = radiusA,
    thicknessB = thicknessA,
    BrB = BrA,
    isAttract = true,
    gap = 0
  } = config;

  let effRadiusB = radiusB;
  let effThicknessB = thicknessB;
  let effBrB = BrB;

  // 鉄板（スチールプレート）の場合、鏡像法（Image Method）を適用
  if (targetType === 'steel') {
    effRadiusB = radiusA;
    effThicknessB = thicknessA;
    effBrB = BrA * 1.12; // 軟鉄板の透磁率集中効果
  }

  const z = Math.max(0, gap);

  // 4つの面対間距離
  const d13 = z;                           // 近接面 - 近接面
  const d14 = z + effThicknessB;           // 近接面 - 遠隔面
  const d23 = z + thicknessA;              // 遠隔面 - 近接面
  const d24 = z + thicknessA + effThicknessB; // 遠隔面 - 遠隔面

  const f13 = calculateDiskPairForce(radiusA, effRadiusB, d13, BrA, effBrB);
  const f14 = calculateDiskPairForce(radiusA, effRadiusB, d14, BrA, effBrB);
  const f23 = calculateDiskPairForce(radiusA, effRadiusB, d23, BrA, effBrB);
  const f24 = calculateDiskPairForce(radiusA, effRadiusB, d24, BrA, effBrB);

  // 面荷重ね合わせの合力
  let rawForce = (f13 - f14 - f23 + f24);
  let netForceN = Math.abs(rawForce);

  // 密着・近接領域での形状効果とマクスウェル応力 (Maxwell Stress Coupling)
  // 近接時 z -> 0 では、極面全域の平均磁界 B_avg により吸着力が最大化
  const minR = Math.min(radiusA, effRadiusB);
  const area = Math.PI * minR * minR;

  // 近接領域補正 (0 ~ 2mm)
  if (z < 0.003) {
    // マクスウェル接触理論吸着力 F_max = (B_eff^2 * A) / (2 * MU_0)
    const B_effA = BrA * (thicknessA / Math.sqrt(radiusA * radiusA + thicknessA * thicknessA));
    const B_effB = effBrB * (effThicknessB / Math.sqrt(effRadiusB * effRadiusB + effThicknessB * effThicknessB));
    
    // 近接時における極面相互の平均磁界
    const B_avg = Math.sqrt(B_effA * B_effB) * 1.25;
    const maxMaxwell = (B_avg * B_avg * area) / (2 * MU_0);

    // z=0 に近づくにつれてマクスウェル解へ漸近
    const t = z / 0.003;
    netForceN = (1 - t) * maxMaxwell + t * netForceN;
  }

  const forceKgf = netForceN / 9.80665;
  const forceGf = forceKgf * 1000;
  const forceLbf = netForceN * 0.224809;

  return {
    forceN: netForceN,
    forceKgf: forceKgf,
    forceGf: forceGf,
    forceLbf: forceLbf
  };
}

/**
 * 距離範囲 [minGap, maxGap] における吸着力データ配列を生成
 */
export function generateDistanceForceCurve(config, minGap = 0, maxGap = 0.05, steps = 50) {
  const data = [];
  const stepSize = (maxGap - minGap) / steps;

  for (let i = 0; i <= steps; i++) {
    const gap = minGap + i * stepSize;
    const res = calculatePullForce({ ...config, gap });
    data.push({
      gapMm: gap * 1000,
      gapM: gap,
      forceN: res.forceN,
      forceKgf: res.forceKgf,
      forceGf: res.forceGf,
      forceLbf: res.forceLbf
    });
  }

  return data;
}

/**
 * 軸上距離 z における磁束密度 B_z [mT] の計算
 */
export function calculateAxialBField(radius, thickness, Br, zMeters) {
  const z = Math.max(0, zMeters);
  const term1 = (z + thickness) / Math.sqrt(radius * radius + (z + thickness) ** 2);
  const term2 = z / Math.sqrt(radius * radius + z * z);
  const B_tesla = (Br / 2) * (term1 - term2);
  return B_tesla * 1000; // mT に変換
}
