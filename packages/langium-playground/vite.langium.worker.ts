import { resolve } from 'path';
import { defineConfig } from 'vite';
import {} from 'langium/lib/'

const config = defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/languages/Langium/langium.worker.ts'),
            name: 'LangiumLanguageServerWorker',
            fileName: () => 'langium.worker.js',
            formats: ['iife']            
        },
        outDir: resolve(__dirname, 'public/generated'),
        emptyOutDir: false,
        commonjsOptions: {
            strictRequires: true
        }
    }
});

export default config;
