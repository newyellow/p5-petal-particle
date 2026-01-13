# p5.js 2.0 花瓣粒子漂浮系統 (Petal Particle System)

這是一個基於 p5.js 2.0 構建的高性能、輕量級花瓣粒子系統，旨在為網頁增添唯美的春季氛圍。它利用 WEBGL 進行 3D 旋轉模擬，並支持作為透明層覆蓋在現有網站之上。

## 集成指南 (Integration Guide)

如果你想將這個粒子系統集成到你自己的網站中，請參考以下步驟：

### 1. 引入依賴
在你的 HTML 文件 `</body>` 標籤結束前，引入 p5.js 庫和 `sketch.js`：

```html
<!-- p5.js 核心庫 -->
<script src="p5.min.js"></script>
<!-- 粒子系統腳本 -->
<script src="sketch.js"></script>
```

### 2. 創建容器
在 HTML 中添加一個專用的容器 div，用於承載粒子畫布：

```html
<div id="petal-canvas-container"></div>
```

### 3. 設置 CSS 樣式
為了讓粒子系統不干擾網站的正常操作（如點擊按鈕、選擇文字），需要設置以下關鍵樣式：

```css
#petal-canvas-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;    /* 確保在最上層 */
  pointer-events: none; /* 關鍵：允許滑鼠點擊穿透到下層元素 */
}
```

### 4. 配置粒子參數
你可以直接在 `sketch.js` 頂部的 `params` 對象中修改參數來調整效果：

- `imageUrls`: 圖片 URL 列表，系統會從中隨機挑選圖片生成粒子。
- `maxParticleCount`: 同時存在的最大粒子數量。
- `emissionRate`: 每秒生成的粒子數量（發射率）。
- `fadeInTime`: 粒子生成時的淡入時間（秒）。
- `fadeOutTime`: 粒子消失時的淡出時間（秒）。
- `minSize` / `maxSize`: 花瓣的大小範圍。
- `baseWind`: 基礎風力（負值代表從右向左吹）。
- `noiseScale` / `noiseStrength`: 風的隨機波動頻率和強度。
- `rotationSpeed`: 花瓣翻滾的速度。
- `gravity`: 下落速度。
- `enableBlur`: 是否開啟景深模糊效果（開啟會消耗更多效能）。
- `maxBlur`: 最大模糊強度。

### 5. 注意事項 (p5.js 2.0)
本系統採用 p5.js 2.0 語法：
- **異步加載**: 不再使用 `preload()`，而是在 `async setup()` 中使用 `await loadImage()`。
- **透明背景**: 使用 `clear()` 代替 `background()` 以確保網頁內容可見。
- **性能**: 默認使用 WEBGL 渲染，建議保持花瓣數量在合理範圍內（建議 50-200 之間）。

## 文件結構
- `index.html`: 演示頁面及樣式參考。
- `sketch.js`: 核心粒子系統邏輯。
- `imgs/petal.png`: 花瓣貼圖文件（可替換為你自己的貼圖）。
