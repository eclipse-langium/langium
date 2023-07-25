//@ts-check
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts', 'src/language-server/main.ts'],
    outdir: 'out',
    outExtension: {
        '.js': '.cjs'
    },
    bundle: true,
    target: "ES2017",
    format: 'cjs',
    loader: { '.ts': 'ts' },
    external: ['vscode'],
    platform: 'node',
    sourcemap: true
});

if (watch) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    ctx.dispose();
}
