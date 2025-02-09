import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import litcss from 'rollup-plugin-postcss-lit';
import serve from 'rollup-plugin-serve';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const dev = process.env.ROLLUP_WATCH;

const serverConfig = dev
	? [
			serve({
				contentBase: './dist',
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
		file: 'dist/dayschedule-editor-card.js',
		format: 'es',
		sourcemap: true,
	},
	plugins: [
		json(),
		replace({
			preventAssignment: true,
			values: {
				'__VERSION__': dev ? '"DEVELOPMENT"' : `${pkg.version}`,
				'process.env.NODE_ENV': JSON.stringify(
					dev ? 'development' : 'production'
				),
			},
		}),
		resolve({
			browser: true,
			preferBuiltins: false,
		}),
		typescript({
			declaration: false,
			noEmitOnError: dev ? false : true,
			typescript: require('typescript'),
			filterRoot: '.',
		}),
		{
			name: 'watch-errors',
			buildEnd(err) {
				if (err && dev) {
					console.error('Build errors:', err);
					this.error = () => {};
				}
			},
		},
		postcss({
			inject: false,
			minimize: true,
		}),
		litcss(),
		...serverConfig,
		!dev && terser(),
	],
};
