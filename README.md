# Garrytor 🎨📷

A professional-grade, beginner-friendly web image editor inspired by Adobe Lightroom. Built with a GPU-accelerated WebGL 2.0 pipeline, background Web Workers, and a Supabase backend, packaged inside a majestic dark glassmorphic UI.

🚀 **Live Site:** [https://garrytor.vercel.app](https://garrytor.vercel.app)

---

## ✨ Features

### 1. ⚙️ GPU-Accelerated Editing Pipeline (WebGL 2.0)
* **Basic Adjustments**: Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Temperature (Color Balance), Tint, Vibrance, Saturation, and Clarity.
* **Tone Curves**: Composite RGB and individual Red, Green, and Blue curves with interactive spline controls.
* **HSL Color Mixer**: Adjust Hue, Saturation, and Luminance across 8 specific color ranges with smooth Gaussian blending.
* **Detail & Effects**: Unsharp mask sharpening and radial vignette filters.
* **Split View**: Horizontal split slider for real-time before/after editing comparison.
* **Histograms**: Real-time luminance and RGB channel histograms with highlight clipping warning indicators.

### 2. 🎭 Scoped Adjustment Masking
* **Brush Masking**: Freehand localized paint mask with custom size, feather, and flow controls.
* **Gradients**: Linear and Radial parametric gradients with drag-and-drop vector guide lines.
* **Localized Slider Controls**: Scoped adjustments (Exposure, Saturation, Temp, etc.) restricted only to the active mask layer.

### 3. 🧹 Content-Aware Healing
* **Telea Inpainting**: A Web Worker executing fast-marching inpainting to remove blemishes, dust, and spots in a non-blocking background thread.
* **Multi-Stroke Cumulative Memory**: CPU canvas cache layers that overlay multiple overlapping brush stamps, synchronized automatically with GPU textures.

### 4. 🔥 Lens Blur (Depth of Field)
* **Bokeh Simulation**: A custom Poisson disc fragment shader that computes the Circle of Confusion (CoC) from a user-selected focal point.
* **Specular Highlight Boost**: Specular highlights glow with adjustable bokeh shape (Circle 🟢 vs. Hexagon ⬡).

### 5. 📷 Camera RAW File Support
* **Binary Carver Web Worker**: Client-side RAW file decoding (DNG, CR2, NEF, ARW, CR3, ORF, RAF, RW2) that extracts high-resolution embedded JPEG previews in under 20ms using signature carving.

### 6. ☁️ Supabase Cloud Synchronization
* **Hybrid Storage Mode**: Operates in local **Guest Mode** (IndexedDB and LocalStorage) or registers user accounts using Supabase Auth.
* **Auto-Save**: Automatic JSONB state serialization and thumbnail synchronization backed by Postgres DB.

---

## 📂 Architecture

```
garrytor/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── styles/
│   │   ├── variables.css      # Design system variables
│   │   ├── main.css           # Global layout & animations
│   │   ├── components.css     # Dark glassmorphic components
│   │   └── auth.css           # Auth page layout
│   ├── engine/
│   │   ├── WebGLRenderer.js   # Main pipeline rendering pass loop
│   │   ├── ShaderProgram.js   # Compiled shader program uniform bindings
│   │   └── TextureManager.js  # GL texture allocations & LUT generators
│   ├── shaders/
│   │   ├── vertex.glsl
│   │   ├── basic-adjustments.glsl
│   │   ├── tone-curve.glsl
│   │   ├── hsl-mixer.glsl
│   │   ├── sharpening.glsl
│   │   ├── vignette.glsl
│   │   ├── healing.glsl
│   │   ├── lens-blur.glsl
│   │   ├── mask-adjustments.glsl
│   │   └── output.glsl
│   ├── state/
│   │   ├── EditState.js       # Core edit properties & schema defaults
│   │   ├── HistoryManager.js  # Undo/Redo state snapshots manager
│   │   └── PresetManager.js   # Preset imports & exports
│   ├── supabase/
│   │   ├── config.js
│   │   ├── auth.js
│   │   ├── storage.js
│   │   └── database.js
│   ├── ui/
│   │   ├── App.js             # Shell router & panel mount manager
│   │   ├── Toolbar.js         # Top bar controls
│   │   ├── Viewport.js        # Canvas interaction handler (Pan, Zoom, Paint)
│   │   ├── panels/            # Sidebar panels (HSL, Curves, Masking, Healing)
│   │   └── components/        # UI components (Slider, Histogram, Onboarding)
│   ├── workers/
│   │   ├── healing.worker.js  # Telea inpainting thread
│   │   └── raw.worker.js      # RAW binary carver thread
│   └── utils/
│       ├── ImageLoader.js     # EXIF orientation parsing
│       └── MathUtils.js       # Color converters
```

---

## 🚀 Setup & Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Dev Server
```bash
npm run dev
```

### 4. Build Production Bundle
```bash
npm run build
```

---

## 📜 License
MIT License. Created by [adithyanj-27](https://github.com/adithyanj-27).
