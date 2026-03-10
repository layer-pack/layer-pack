/**
 * @file glob2Js/default.js
 *
 * Default glob-import codec. Generates synchronous `require()` calls for each matched
 * file. Used when no `?using=` query parameter is specified.
 *
 * Each file in the glob result becomes a `const <key> = require("<uPath>")` statement.
 * The caller (`utils.indexOf`) then builds named exports from the captured path segments.
 */
module.exports = {
	/**
	 * Returns any preamble code that must appear at the top of the virtual file before
	 * individual imports are emitted. The default codec needs no preamble.
	 *
	 * @returns {string}
	 */
	echoRequired( key, uPath ) {
		return "";
	},
	/**
	 * Returns the import statement for a single matched file.
	 *
	 * @param {string} key   - Sanitised variable name derived from the file path
	 * @param {string} uPath - Layer-rooted import path (e.g. `"App/components/Button.jsx"`)
	 * @returns {string}
	 */
	echoImport( key, uPath ) {
		return `const ${key} = require("${uPath}");`
	}
}
