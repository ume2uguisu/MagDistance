import { calculateSurfaceB, calculatePullForce, generateDistanceForceCurve } from './magnetics.js';

console.log("==========================================");
console.log(" 🧲 MagDistance - 物理計算＆ヨークテスト");
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
const pullBare = calculatePullForce({
  radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, yokeA: 'none',
  targetType: 'steel', gap: 0
});
assert(pullBare.forceKgf > 5.0 && pullBare.forceKgf < 9.0, `対鉄板 密着時吸着力(約6.5kgf): ${pullBare.forceKgf.toFixed(2)}kgf`);

// テスト3: ヨーク構造による吸着力向上効果 (ベア < 背面ヨーク < キャップヨーク)
const pullBack = calculatePullForce({
  radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, yokeA: 'back', targetType: 'steel', gap: 0
});
const pullCup = calculatePullForce({
  radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, yokeA: 'cup', targetType: 'steel', gap: 0
});

assert(pullBack.forceKgf > pullBare.forceKgf, `背面ヨーク付で吸着力が向上 (ベア:${pullBare.forceKgf.toFixed(2)}kgf < 背面:${pullBack.forceKgf.toFixed(2)}kgf)`);
assert(pullCup.forceKgf > pullBack.forceKgf, `キャップヨーク付で吸着力が大幅向上 (背面:${pullBack.forceKgf.toFixed(2)}kgf < キャップ:${pullCup.forceKgf.toFixed(2)}kgf)`);

// テスト4: 離隔距離に応じた吸着力の減衰
const pull1 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, gap: 0.001, targetType: 'steel' });
const pull5 = calculatePullForce({ radiusA: 0.01, thicknessA: 0.005, BrA: 1.32, gap: 0.005, targetType: 'steel' });
assert(pullBare.forceN > pull1.forceN, `離隔1mmで減衰 (0mm:${pullBare.forceN.toFixed(1)}N > 1mm:${pull1.forceN.toFixed(1)}N)`);
assert(pull1.forceN > pull5.forceN, `離隔5mmで減衰 (1mm:${pull1.forceN.toFixed(1)}N > 5mm:${pull5.forceN.toFixed(1)}N)`);

console.log("------------------------------------------");
console.log(`テスト結果: 成功 ${passedCount} 件 / 失敗 ${failedCount} 件`);
console.log("==========================================");

if (failedCount > 0) {
  process.exit(1);
}
