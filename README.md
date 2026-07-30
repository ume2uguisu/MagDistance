# 🧲 MagDistance - 磁石吸着力・離隔距離シミュレーター

2つの磁石の仕様（直径・厚み・磁束密度）を指定し、密着状態から指定した離隔距離までの吸着力（引き合う力・反発力）を物理計算し、インタラクティブにグラフ＆2D磁気ビジュアル表示するWebアプリケーションです。

ユーザーはウェブブラウザ上で磁石の材質（ネオジム N52 / N42、フェライト等）、寸法、対抗対象（磁石 vs 磁石 / 磁石 vs 鉄板）を自由に選択・カスタマイズし、リアルタイムで吸着力特性カーブや数値を解析・エクスポート（CSV）できます。

---

## 🌟 主な機能

- **物理計算モデル**:
  - 等価磁荷モデル (Equivalent Magnetic Surface Charge Model) & ガウス＝ルジャンドル数値積分による高精度な吸引力/反発力算出
  - 鉄板（スチールプレート）に対する鏡像法 (Image Charge Method) 吸着力算出
  - 表面中心磁束密度 $B_0$ と残留磁束密度 $B_r$ の自動相互変換計算
- **インタラクティブUI & レスポンシブデザイン**:
  - モダンなダークテーマ、グラスモフィズム、グラデーションカラー
  - クイック統計カード（密着時、1mm, 5mm, 10mm 離隔時吸着力）
  - 単位切り替え（N, kgf, gf, lbf）
  - 作用切り替え（吸引 / 反発）
- **2D 磁場ビジュアルアニメーション**:
  - 磁石の実際の寸法比率を描画し、離隔距離スライダーに連動して磁力線（Magnetic Flux Lines）を動的にアニメーション表示
- **グラフ＆数値データ出力**:
  - Chart.js による離隔距離 vs 吸着力カーブプロット（線形 / 対数スケール切り替え）
  - 詳細計算数値テーブル & 1クリックでの CSV ダウンロードエクスポート

---

## 🚀 GitHub Pages での公開方法 (Deployment Guide)

このWebアプリは純粋な HTML5 + Modern ES JavaScript + CSS で構築されているため、GitHub リポジトリの **main** ブランチの root から直接 GitHub Pages で即座にホスティングできます。

### 公開ステップ

1. **GitHub リポジトリの設定を開く**:
   GitHub で [`https://github.com/ume2uguisu/MagDistance`](https://github.com/ume2uguisu/MagDistance) にアクセスし、上部タブの **Settings** をクリックします。

2. **Pages セクションの選択**:
   左側メニューの **Pages** （Build and deployment）をクリックします。

3. **Source の設定**:
   - **Source**: `Deploy from a branch` を選択します。
   - **Branch**: `main` ブランチ、フォルダは `/ (root)` を選択して **Save** をクリックします。

4. **公開完了**:
   数分以内に GitHub Pages へのビルドが完了し、指定の URL（例: `https://ume2uguisu.github.io/MagDistance/`）でWebアプリが世界中に公開されます！

---

## 💻 ローカル開発・確認方法

ブラウザで `index.html` を直接開くか、ローカルWebサーバー（VS Code Live Server または python / node.js サーバー）を起動して確認できます。

```bash
# Node.js npx 経由でローカルサーバー起動例
npx serve .
```

---

## 📄 ライセンス

[MIT License](LICENSE)
