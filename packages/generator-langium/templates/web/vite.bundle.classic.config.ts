import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'scripts', 'bundleClassic.js'),
            name: 'monaco-classic',
            fileName: () => 'index.js',
            formats: ['es']
        },
        outDir: 'static/bundleClassic',
        assetsDir: 'static/bundleClassic/assets',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                name: 'monaco-classic',
                exports: 'named',
                sourcemap: true,
                assetFileNames: (assetInfo) => {
                    return `assets/${assetInfo.name}`;
                }
            }
        }
    }
});
