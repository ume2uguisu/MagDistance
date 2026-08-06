/**
 * MagDistance - Physics Calculation Engine for Magnet Pull Force & Magnetic Fields
 * 磁石間・磁石鉄板間の吸着力および磁界プロファイル計算エンジン（完全単調減少物理モデル）
 */

// 物理定数
export const MU_0 = 4 * Math.PI * 1e-7; // 真空の透磁率 [H/m or N/A^2]

/**
 * 主要な磁石材料のプリセット定義
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
 * ヨーク（磁性体ケース/バックプレート）の型定義
 */
export const YOKE_TYPES = {
  'none': { name: 'なし (ベア磁石)', boostFactor: 1.0, desc: '通常の裸磁石' },
  'back': { name: '背面ヨーク (鉄板バックプレート)', boostFactor: 1.35, desc: '背面への漏れ磁束を前面に集中' },
  'cup': { name: 'キャップ/カップ型ヨーク', boostFactor: 2.2, desc: '背面および側面を鉄ケースで覆い前面に超集中' }
};

/**
 * 円柱磁石の表面中心における磁束密度 B_center [T] を算出
 */
export function calculateSurfaceB(radius, thickness, Br, yokeType = 'none') {
  if (radius <= 0 || thickness <= 0 || Br <= 0) return 0;
  const baseB = (Br / 2) * (thickness / Math.sqrt(radius * radius + thickness * thickness));
  
  if (yokeType === 'back') {
    return baseB * 1.25;
  } else if (yokeType === 'cup') {
    return baseB * 1.65;
  }
  return baseB;
}

/**
 * 表面中心磁束密度 B_center から残留磁束密度 Br [T] を逆算
 */
export function calculateBrFromSurfaceB(radius, thickness, Bcenter, yokeType = 'none') {
  if (radius <= 0 || thickness <= 0 || Bcenter <= 0) return 0;
  let rawBr = 2 * Bcenter * (Math.sqrt(radius * radius + thickness * thickness) / thickness);
  if (yokeType === 'back') rawBr /= 1.25;
  if (yokeType === 'cup') rawBr /= 1.65;
  return rawBr;
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
  const dist = Math.max(1e-5, d);
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
 * 2つの磁石間、または磁石と鉄板間の吸着力 F(z) [N] を計算（厳密単調減少）
 */
export function calculatePullForce(config) {
  const {
    radiusA,
    thicknessA,
    BrA,
    yokeA = 'none',
    targetType = 'magnet',
    radiusB = radiusA,
    thicknessB = thicknessA,
    BrB = BrA,
    yokeB = 'none',
    isAttract = true,
    gap = 0
  } = config;

  let effRadiusB = radiusB;
  let effThicknessB = thicknessB;
  let effBrB = BrB;

  if (targetType === 'steel') {
    effRadiusB = radiusA;
    effThicknessB = thicknessA;
    effBrB = BrA * 1.12;
  }

  let effBrA = BrA;
  if (yokeA === 'back') effBrA *= 1.25;
  if (yokeA === 'cup') effBrA *= 1.45;

  if (targetType === 'magnet') {
    if (yokeB === 'back') effBrB *= 1.25;
    if (yokeB === 'cup') effBrB *= 1.45;
  }

  const z = Math.max(0, gap);

  const d13 = z;
  const d14 = z + effThicknessB;
  const d23 = z + thicknessA;
  const d24 = z + thicknessA + effThicknessB;

  const f13 = calculateDiskPairForce(radiusA, effRadiusB, d13, effBrA, effBrB);
  const f14 = calculateDiskPairForce(radiusA, effRadiusB, d14, effBrA, effBrB);
  const f23 = calculateDiskPairForce(radiusA, effRadiusB, d23, effBrA, effBrB);
  const f24 = calculateDiskPairForce(radiusA, effRadiusB, d24, effBrA, effBrB);

  let backDampingA = (yokeA !== 'none') ? 0.2 : 1.0;
  let backDampingB = (yokeB !== 'none') ? 0.2 : 1.0;
  let backDamping = Math.min(backDampingA, backDampingB);

  let rawForce = (f13 - f14 * backDamping - f23 * backDamping + f24 * backDamping);
  let farForceN = Math.abs(rawForce);

  // 密着吸着力 Max Contact Force (z = 0)
  const minR = Math.min(radiusA, effRadiusB);
  const area = Math.PI * minR * minR;

  const B_baseA = calculateSurfaceB(radiusA, thicknessA, BrA, 'none');
  const B_baseB = (targetType === 'steel') ? B_baseA * 1.1 : calculateSurfaceB(effRadiusB, effThicknessB, BrB, 'none');

  let yokeBoost = 1.0;
  if (yokeA === 'back') yokeBoost = 1.35;
  if (yokeA === 'cup') yokeBoost = 2.2;
  if (targetType === 'magnet') {
    if (yokeB === 'back') yokeBoost *= 1.25;
    if (yokeB === 'cup') yokeBoost *= 1.8;
  }

  const B_avg = Math.sqrt(B_baseA * B_baseB) * 2.4;
  const maxMaxwell = (B_avg * B_avg * area) / (2 * MU_0) * yokeBoost;

  // 滑らかな減衰関数による単調減少の保証
  const decayLength = Math.min(radiusA, thicknessA) * 0.7;
  const proximityFactor = Math.exp(-z / decayLength);

  let netForceN = maxMaxwell * proximityFactor + farForceN * (1 - proximityFactor);

  // 密着時 (z=0) より決して上回らない厳密な単調減少上限ガード
  const monotonicUpper = maxMaxwell * Math.exp(-z / (decayLength * 1.8));
  netForceN = Math.min(monotonicUpper, netForceN);

  if (!isAttract) {
    netForceN *= 0.85;
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
export function calculateAxialBField(radius, thickness, Br, zMeters, yokeType = 'none') {
  const z = Math.max(0, zMeters);
  const term1 = (z + thickness) / Math.sqrt(radius * radius + (z + thickness) ** 2);
  const term2 = z / Math.sqrt(radius * radius + z * z);
  let B_tesla = (Br / 2) * (term1 - term2);

  if (yokeType === 'back') B_tesla *= 1.25;
  if (yokeType === 'cup') B_tesla *= 1.65;

  return B_tesla * 1000;
}
