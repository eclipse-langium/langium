import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'scripts', 'bundle.js'),
            name: 'monaco-bundle',
            fileName: () => 'index.js',
            formats: ['es']
        },
        outDir: 'static/bundle',
        assetsDir: 'static/bundle/assets',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                name: 'monaco-bundle',
                exports: 'named',
                sourcemap: true,
                assetFileNames: (assetInfo) => {
                    return `assets/${assetInfo.name}`;
                }
            }
        }
    }
});
