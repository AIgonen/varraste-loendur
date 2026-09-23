import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// onnxruntime-web laetakse <script>-iga public/ort/ kaustast (mitte bundle'isse) – nii töötab mitmelõimeline WASM ja WebGPU worker õigesti.
// GitHub Pages serveerib alamteelt /<repo>/ – base tuleb repo nimest (Action annab selle ette)
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
})
