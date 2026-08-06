import { calculateSurfaceB, calculatePullForce, generateDistanceForceCurve } from './magnetics.js';

console.log("==========================================");
console.log(" 🧲 MagDistance - 物理計算＆単調減少テスト");
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
const bSurf = calculateSurfaceB(0.01, 0.005, 1.32);
assert(bSurf > 0.28 && bSurf < 0.31, `表面磁束密度が正常範囲(約295mT): ${(bSurf * 1000).toFixed(1)}mT`);

// テスト2: 密着時吸着力 (ベア磁石)
const pullBare0 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, targetType: 'steel', gap: 0 });
const pullBare05 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, targetType: 'steel', gap: 0.0005 });
const pullBare1 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, targetType: 'steel', gap: 0.001 });
const pullBare2 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, targetType: 'steel', gap: 0.002 });
const pullBare5 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, targetType: 'steel', gap: 0.005 });

assert(pullBare0.forceKgf > 5.0 && pullBare0.forceKgf < 9.0, `対鉄板 密着時吸着力(約7.0kgf): ${pullBare0.forceKgf.toFixed(2)}kgf`);

// 厳密な単調減少テスト: 0.0mm > 0.5mm > 1.0mm > 2.0mm > 5.0mm
assert(pullBare0.forceN > pullBare05.forceN, `0.0mm (${pullBare0.forceN.toFixed(1)}N) > 0.5mm (${pullBare05.forceN.toFixed(1)}N) で密着時が最も強い`);
assert(pullBare05.forceN > pullBare1.forceN, `0.5mm (${pullBare05.forceN.toFixed(1)}N) > 1.0mm (${pullBare1.forceN.toFixed(1)}N) で単調減少`);
assert(pullBare1.forceN > pullBare2.forceN, `1.0mm (${pullBare1.forceN.toFixed(1)}N) > 2.0mm (${pullBare2.forceN.toFixed(1)}N) で単調減少`);
assert(pullBare2.forceN > pullBare5.forceN, `2.0mm (${pullBare2.forceN.toFixed(1)}N) > 5.0mm (${pullBare5.forceN.toFixed(1)}N) で単調減少`);

// ヨーク構造の比較
const pullBack = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, yokeA: 'back', targetType: 'steel', gap: 0 });
const pullCup = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, yokeA: 'cup', targetType: 'steel', gap: 0 });

assert(pullBack.forceKgf > pullBare0.forceKgf, `背面ヨーク付で吸着力が向上 (ベア:${pullBare0.forceKgf.toFixed(2)}kgf < 背面:${pullBack.forceKgf.toFixed(2)}kgf)`);
assert(pullCup.forceKgf > pullBack.forceKgf, `キャップヨーク付で吸着力が大幅向上 (背面:${pullBack.forceKgf.toFixed(2)}kgf < キャップ:${pullCup.forceKgf.toFixed(2)}kgf)`);

console.log("------------------------------------------");
console.log(`テスト結果: 成功 ${passedCount} 件 / 失敗 ${failedCount} 件`);
console.log("==========================================");

if (failedCount > 0) {
  process.exit(1);
}
