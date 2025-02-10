import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import template from 'rollup-plugin-html-literals';
import postcss from 'rollup-plugin-postcss';
import serve from 'rollup-plugin-serve';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const dev = process.env.ROLLUP_WATCH;

const serverConfig = dev
	? [
			serve({
				contentBase: ['./dist'],
				host: '0.0.0.0',
				port: 4000,
				allowCrossOrigin: true,
				headers: {
					'Access-Control-Allow-Origin': '*',
				},
			}),
	  ]
	: [];

export default {
	input: 'src/index.ts',
	output: {
		dir: 'dist',
		format: 'es',
		sourcemap: dev,
		inlineDynamicImports: true,
		entryFileNames: 'dayschedule-editor-card.js',
	},
	plugins: [
		template(),
		nodeResolve({
			browser: true,
			preferBuiltins: false,
			dedupe: ['lit-element', 'lit-html'],
		}),
		json(),
		postcss({
			include: ['**/*.css', '**/*.scss'],
			inject: false,
			modules: false,
			minimize: !dev,
			extract: false,
			use: ['sass'],
		}),
		typescript({
			declaration: false,
			module: 'ESNext',
			target: 'es2017',
		}),
		replace({
			preventAssignment: true,
			values: {
				'__VERSION__': dev ? '"DEVELOPMENT"' : `"${pkg.version}"`,
				'process.env.NODE_ENV': JSON.stringify(
					dev ? 'development' : 'production'
				),
			},
		}),
		...serverConfig,
		// minify code whithin html literals in lit elements
		!dev &&
			terser({
				format: {
					comments: false,
				},
				compress: {
					defaults: true,
					passes: 3,
				},
			}),
	],
	external: [/^custom-card-helpers/],
};
