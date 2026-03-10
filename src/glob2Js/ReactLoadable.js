/**
 * @file glob2Js/ReactLoadable.js
 *
 * Glob-import codec that wraps each matched component using `@loadable/component`.
 * Requires `@loadable/component` to be installed in the project.
 *
 * Each exported component is a `React.forwardRef` wrapper around a `loadable()`
 * dynamic import, enabling SSR-compatible code splitting.
 *
 * Usage: `import { Admin } from "App/pages/(**\/*.jsx)?using=ReactLoadable"`
 */
module.exports = {
	/**
	 * Emits the preamble: React and @loadable/component imports.
	 *
	 * @param {object} [params] - Parsed query params (unused here)
	 * @returns {string}
	 */
	echoRequired( params = {} ) {
		return `
import ____$React from 'react';
import ____$loadable from '@loadable/component'

`;
	},
	/**
	 * Emits a `@loadable/component` wrapper for a single matched file.
	 *
	 * @param {string} key      - Sanitised variable name
	 * @param {string} uPath    - Layer-rooted import path
	 * @param {object} [params] - Parsed query params (unused here)
	 * @returns {string}
	 */
	echoImport( key, uPath, params = {} ) {
		return `
const ___$${key} = ____$loadable(() => import('${uPath}'));
const ${key} = ____$React.forwardRef(
		(props,ref)=>
			____$React.createElement(
				___$${key},
				 {
					 ...props,
					 ref
				 }
			 )
	);
`;
	}
}
