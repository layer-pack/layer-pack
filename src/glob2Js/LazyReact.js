/**
 * @file glob2Js/LazyReact.js
 *
 * Glob-import codec that wraps each matched file in `React.lazy(() => import(...))`.
 * Each lazily-loaded component becomes a separate webpack chunk.
 *
 * Usage: `import { Admin } from "App/pages/(**\/*.jsx)?using=LazyReact"`
 *
 * Optional query params:
 *   - `fallback` — import path of a custom fallback component shown while loading.
 *     Defaults to a plain `<div>...</div>` placeholder.
 *
 * Note: consumers must wrap these components in a `<Suspense>` boundary themselves.
 * Use `SuspenseReact` if you want the boundary built in automatically.
 */
module.exports = {
	/**
	 * Emits the preamble: React import and optional fallback component import/definition.
	 *
	 * @param {object} [params]          - Parsed query params from the import string
	 * @param {string} [params.fallback] - Import path for a custom Suspense fallback
	 * @returns {string}
	 */
	echoRequired( params = {} ) {
		return `
import ____$React from 'react';
${
			params?.fallback
			? "import ____$FallBack from \"" + params?.fallback + "\";"
			: `const ____$FallBack = (props)=>____$React.createElement("div", props, "...")`
		}
`;
	},
	/**
	 * Emits a `React.lazy` import for a single matched file.
	 *
	 * @param {string} key            - Sanitised variable name
	 * @param {string} uPath          - Layer-rooted import path
	 * @param {object} [params]       - Parsed query params (unused here)
	 * @returns {string}
	 */
	echoImport( key, uPath, params = {} ) {
		return `
const ${key} = ____$React.lazy(() => import('${uPath}'))
`;
	}
}
