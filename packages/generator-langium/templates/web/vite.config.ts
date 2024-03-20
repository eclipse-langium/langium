/* eslint-disable header/header */
import { defineConfig } from 'vite';
import * as path from 'path';
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin';

export default defineConfig(() => {
    const config = {
        build: {
            target: 'esnext',
            rollupOptions: {
                input: {
                    monacoClassic: path.resolve(__dirname, '/static/monacoClassic.html'),
                    monacoExtended: path.resolve(__dirname, '/static/monacoExtended.html'),
                }
            }
        },
        resolve: {
            dedupe: ['vscode']
        },
        optimizeDeps: {
            esbuildOptions: {
                plugins: [
                    importMetaUrlPlugin
                ]
            }
        }
    };
    return config;
});
