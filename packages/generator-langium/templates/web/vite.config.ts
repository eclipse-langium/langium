import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        origin: 'http://127.0.0.1:28080',
        port: 28080,
        host: '0.0.0.0'
    }
});
