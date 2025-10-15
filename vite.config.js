import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'SpellshapeThree',
      fileName: 'spellshape-three',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: [
        'three',
        'three/addons/controls/OrbitControls.js',
        'three/addons/exporters/OBJExporter.js',
        'dat.gui'
      ],
      output: {
        globals: {
          'three': 'THREE',
          'dat.gui': 'dat',
          'three/addons/controls/OrbitControls.js': 'THREE.OrbitControls',
          'three/addons/exporters/OBJExporter.js': 'THREE.OBJExporter'
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['three']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      "5173--0199e76f-9146-7cc7-9f64-c4d4aee7dd04.eu-central-1-01.gitpod.dev"
    ]
  }
});



