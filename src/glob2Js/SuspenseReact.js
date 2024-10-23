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
