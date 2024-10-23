module.exports = {
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
	echoImport( key, uPath, params = {} ) {
		return `
const ${key} = ____$React.lazy(() => import('${uPath}'))
`;
	}
}
