import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'scripts', 'bundleVscodeApi.js'),
            name: 'monaco-vscodeApi',
            fileName: () => 'index.js',
            formats: ['es']
        },
        outDir: 'static/bundleVscodeApi',
        assetsDir: 'static/bundleVscodeApi/assets',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                name: 'monaco-vscodeApi',
                exports: 'named',
                sourcemap: true,
                assetFileNames: (assetInfo) => {
                    return `assets/${assetInfo.name}`;
                }
            }
        }
    }
});
