/**
 * @file glob2Js/SuspenseReact.js
 *
 * Glob-import codec that wraps each matched component in both `React.lazy` and an
 * inline `React.Suspense` boundary. Unlike `LazyReact`, the consuming code does NOT
 * need to provide its own `<Suspense>` wrapper — the boundary is baked in.
 *
 * Each exported component is a `React.forwardRef` wrapper that renders:
 *   <Suspense fallback={<FallBack />}>
 *     <LazyComponent {...props} ref={ref} />
 *   </Suspense>
 *
 * Usage: `import { Admin } from "App/pages/(**\/*.jsx)?using=SuspenseReact"`
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
	 * Emits a self-contained lazy+suspense wrapper for a single matched file.
	 *
	 * @param {string} key      - Sanitised variable name
	 * @param {string} uPath    - Layer-rooted import path
	 * @param {object} [params] - Parsed query params (unused here)
	 * @returns {string}
	 */
	echoImport( key, uPath, params = {} ) {
		return `
const Lazy_${key} = ____$React.lazy(() => import('${uPath}'))
const ${key} = ____$React.forwardRef(
		(props,ref)=>
		____$React.createElement(
				____$React.Suspense,
				 {
					 fallback:____$React.createElement(____$FallBack)
				 },
				 ____$React.createElement(Lazy_${key}, {...props, ref})
			 )
	);
`;
	}
}
