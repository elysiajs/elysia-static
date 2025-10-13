import { $ } from 'bun'
import { build, type Options } from 'tsup'

await $`rm -rf dist`

const external = ['fast-decode-uri-component']

const tsupConfig: Options = {
    entry: ['src/**/*.ts'],
    minifySyntax: true,
	minifyWhitespace: false,
	minifyIdentifiers: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    bundle: false,
    external
} satisfies Options

await Promise.all([
    // ? tsup esm
    build({
        outDir: 'dist',
        format: 'esm',
        target: 'node20',
        cjsInterop: false,
        external,
        ...tsupConfig
    }),
    // ? tsup cjs
    build({
        outDir: 'dist/cjs',
        format: 'cjs',
        target: 'node20',
        external,
        // dts: true,
        ...tsupConfig
    })
])

await $`tsc --project tsconfig.dts.json`

await Promise.all([$`cp dist/*.d.ts dist/cjs`])

process.exit()
