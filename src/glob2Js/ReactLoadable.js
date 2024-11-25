module.exports = {
	echoRequired( params = {} ) {
		return `
import ____$React from 'react';
import ____$loadable from '@loadable/component'

`;
	},
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
