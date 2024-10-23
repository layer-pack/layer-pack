module.exports = {
	echoRequired( params = {} ) {
		return `
import ____$loadable from '@loadable/component'

`;
	},
	echoImport( key, uPath, params = {} ) {
		return `
const ${key} = ____$loadable(() => import('${uPath}'));
`;
	}
}
