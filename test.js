import { calculateSurfaceB, calculatePullForce, generateDistanceForceCurve } from './magnetics.js';

console.log("==========================================");
console.log(" 🧲 MagDistance - 物理計算ユニットテスト");
console.log("==========================================");

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failedCount++;
  }
}

// テスト1: 表面磁束密度 B0 の計算
const bSurf = calculateSurfaceB(0.01, 0.005, 1.32); // R=10mm, t=5mm, N42
assert(bSurf > 0.28 && bSurf < 0.31, `表面磁束密度が正常範囲(約295mT): ${(bSurf * 1000).toFixed(1)}mT`);

// テスト2: 密着時吸着力 (0mm)
const pull0 = calculatePullForce({
  radiusA: 0.01,
  thicknessA: 0.005,
  BrA: 1.32,
  targetType: 'magnet',
  radiusB: 0.01,
  thicknessB: 0.005,
  BrB: 1.32,
  isAttract: true,
  gap: 0
});
assert(pull0.forceKgf > 5.0 && pull0.forceKgf < 9.0, `密着時吸着力が正常範囲(約6.9kgf): ${pull0.forceKgf.toFixed(2)}kgf`);

// テスト3: 離隔距離に応じた吸着力の減衰 (0mm > 1mm > 5mm > 10mm)
const pull1 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, gap: 0.001 });
const pull5 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, gap: 0.005 });
const pull10 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, gap: 0.010 });

assert(pull0.forceN > pull1.forceN, `離隔1mmで吸着力が減衰 (0mm:${pull0.forceN.toFixed(1)}N > 1mm:${pull1.forceN.toFixed(1)}N)`);
assert(pull1.forceN > pull5.forceN, `離隔5mmで吸着力が減衰 (1mm:${pull1.forceN.toFixed(1)}N > 5mm:${pull5.forceN.toFixed(1)}N)`);
assert(pull5.forceN > pull10.forceN, `離隔10mmで吸着力が減衰 (5mm:${pull5.forceN.toFixed(1)}N > 10mm:${pull10.forceN.toFixed(1)}N)`);

// テスト4: 離隔距離 vs 吸着力カーブ生成
const curve = generateDistanceForceCurve({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32 }, 0, 0.03, 30);
assert(curve.length === 31, `生成データ点数が正しい (指定30分割 -> 31点)`);

console.log("------------------------------------------");
console.log(`テスト結果: 成功 ${passedCount} 件 / 失敗 ${failedCount} 件`);
console.log("==========================================");

if (failedCount > 0) {
  process.exit(1);
}
