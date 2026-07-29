import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default [
	includeIgnoreFile(gitignorePath),
	{
		// Agent git worktrees live INSIDE the repo, so eslint walks them and
		// reports every lint error in every checked-out branch on top of this
		// tree's own — 58 duplicate errors across three worktrees when this was
		// added. They are separate checkouts with their own lint runs; `.gitignore`
		// does not cover them (git tracks worktrees, it does not ignore them), and
		// `/.svelte-kit` is root-anchored so their build output leaks through too.
		ignores: ['.claude/worktrees/**']
	},
	js.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js'],
		languageOptions: { parserOptions: { svelteConfig } }
	}
];
