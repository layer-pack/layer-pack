module.exports = {
	echoRequired( key, uPath ) {
		return "";
	},
	echoImport( key, uPath ) {
		return `const ${key} = require("${uPath}");`
	}
}
