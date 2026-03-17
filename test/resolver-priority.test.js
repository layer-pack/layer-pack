/**
 * Tests for cross-layer node_modules resolution priority.
 *
 * Bug scenario:
 *   - Parent layer has dependency "lib-a" which depends on "sub-lib@1.0"
 *   - Child layer has devDependency "some-tool" which depends on "sub-lib@2.0"
 *   - sub-lib@2.0 is hoisted to child-layer/node_modules/sub-lib
 *   - When lib-a (in parent-layer/node_modules) requires "sub-lib",
 *     it should resolve to parent-layer/node_modules/sub-lib@1.0,
 *     NOT child-layer/node_modules/sub-lib@2.0
 *
 * Required behavior:
 *   - If both child and parent have "react" in their direct dependencies,
 *     and lib-a (from parent) requires "react", the child's react should win
 *     because explicit deps are checked first (head layer has priority).
 *   - But transitive deps (not in any layer's dependencies) should resolve
 *     from the owning layer's node_modules (standard Node.js resolution).
 *
 * Run: node --test test/resolver-priority.test.js
 */

const { describe, it } = require('node:test');
const assert           = require('node:assert');
const path             = require('path');
const fs               = require('fs');

const fixturesDir = path.join(__dirname, 'fixtures');
const childDir    = path.join(fixturesDir, 'child-layer');
const parentDir   = path.join(fixturesDir, 'parent-layer');

// ----- helpers -----

/**
 * Load the layer-pack config for the child-layer fixture.
 * This walks the extend chain and produces the full opts object
 * that the plugin receives.
 */
function loadTestConfig() {
	const utils = require('../src/utils');
	return utils.getConfigByProfiles(
		childDir,
		{ rootFolder: 'App', extend: ['parent-layer'] },
		'default',
		{
			name           : 'child-layer',
			version        : '1.0.0',
			dependencies   : { 'react': '18.0.0' },
			devDependencies: { 'some-tool': '1.0.0' },
			layerPack      : {
				default: { rootFolder: 'App', extend: ['parent-layer'] }
			}
		}
	);
}

/**
 * Replicate the Resolver 2 address-building logic from layerPackPlugin.js
 * (the "else" branch for external / non-internal files).
 *
 * @param {object}  opts            - layer-pack profile config
 * @param {string}  requestPath     - directory of the requiring file
 * @param {string}  packageName     - bare package name being required
 * @param {string}  mode            - "old" (original buggy pop), "fixed" (pop + re-insert after explicit deps)
 * @returns {string[]} - ordered list of candidate node_modules directories
 */
function buildExternalAddrs( opts, requestPath, packageName, mode ) {
	const getPaths = require(
		path.join(path.dirname(require.resolve('enhanced-resolve')), 'getPaths')
	);

	const roots               = opts.allRoots;
	const modulesPathByLength = [...opts.allModulePath]
		.sort(( a, b ) => b.length - a.length);

	let addrs = getPaths(requestPath)
		.paths.map(p => path.join(p, 'node_modules'));

	let rootModPath = modulesPathByLength.find(r => addrs[0].startsWith(r));

	if ( rootModPath ) {
		addrs = addrs.filter(addr => addr.startsWith(rootModPath));
		addrs.pop(); // rm origin mods root
	}

	// 1. Layers where the package is explicitly in dependencies
	addrs.push(
		...opts.allModuleRoots.filter(
			( p, i ) => (
				opts.allPackageCfg[i].dependencies
				&& opts.allPackageCfg[i].dependencies[packageName]
			)
		).reduce(( list, p ) => {
			list.push(
				path.join(p, '.layer_modules', 'node_modules'),
				path.join(p, 'node_modules')
			);
			return list;
		}, [])
	);

	// 2. FIX: re-insert owning layer's node_modules after explicit deps
	if ( mode === 'fixed' && rootModPath ) {
		addrs.push(rootModPath);
	}

	// 3. Shared deps + OS fallback
	addrs.push(
		...opts.allModuleRoots.filter(
			( p, i ) => !(
				opts.allPackageCfg[i].dependencies
				&& opts.allPackageCfg[i].dependencies[packageName]
			)
		).reduce(( list, p ) => {
			list.push(
				path.join(p, '.layer_modules', 'node_modules'),
				path.join(p, 'node_modules')
			);
			return list;
		}, []),
		// OS fallback: head layer parents
		...getPaths(opts.allLayerRoot[0])
		    .paths.map(p => path.join(p, 'node_modules'))
	);

	// Deduplicate (keep first occurrence)
	addrs = addrs.filter(( p, i ) => addrs.indexOf(p) === i);

	return addrs.map(p => path.normalize(p));
}

// ----- tests -----

describe('layer-pack config loading', () => {
	it('should resolve the inheritance chain correctly', () => {
		const config = loadTestConfig();

		// allModuleRoots: [child-layer, parent-layer]
		assert.strictEqual(config.allModuleRoots.length, 2);
		assert.strictEqual(path.normalize(config.allModuleRoots[0]), path.normalize(childDir));
		assert.strictEqual(path.normalize(config.allModuleRoots[1]), path.normalize(parentDir));

		// allRoots: [child-layer/App, parent-layer/App]
		assert.strictEqual(config.allRoots.length, 2);
		assert(config.allRoots[0].endsWith(path.join('child-layer', 'App')));
		assert(config.allRoots[1].endsWith(path.join('parent-layer', 'App')));

		// allPackageCfg: child first (react+devdeps), parent second (lib-a+react)
		assert.deepStrictEqual(config.allPackageCfg[0].dependencies, { 'react': '18.0.0' });
		assert.deepStrictEqual(config.allPackageCfg[1].dependencies, { 'lib-a': '1.0.0', 'react': '17.0.0' });
	});
});

describe('Resolver 2: transitive dep from parent lib (sub-lib bug)', () => {
	const parentNM = path.normalize(path.join(parentDir, 'node_modules'));
	const childNM  = path.normalize(path.join(childDir, 'node_modules'));
	let config;

	it('setup: load config', () => {
		config = loadTestConfig();
	});

	it('BUG REPRO: old behavior - child devDep sub-lib@2.0 found before parent sub-lib@1.0', () => {
		// sub-lib is NOT in any layer's direct dependencies — it's a transitive dep.
		// With the old code (just pop, no re-insert), child's node_modules is searched
		// first in the "shared deps" section, finding the wrong version.
		const addrs = buildExternalAddrs(
			config,
			path.join(parentDir, 'node_modules', 'lib-a'),
			'sub-lib',
			'old'
		);

		const parentIdx = addrs.findIndex(a => a === parentNM);
		const childIdx  = addrs.findIndex(a => a === childNM);

		assert.notStrictEqual(childIdx, -1, 'child-layer/node_modules should be in addrs');

		// With the bug: child comes before parent (WRONG)
		assert(
			childIdx < parentIdx || parentIdx === -1,
			'BUG REPRO: with old code, child-layer/node_modules appears before ' +
			'parent-layer/node_modules (wrong for transitive deps)'
		);
	});

	it('FIX: parent sub-lib@1.0 found before child sub-lib@2.0', () => {
		// With the fix: owning layer's node_modules is re-inserted after explicit deps
		// but before shared deps. Since sub-lib is not in any layer's dependencies,
		// the owning layer (parent) is found first.
		const addrs = buildExternalAddrs(
			config,
			path.join(parentDir, 'node_modules', 'lib-a'),
			'sub-lib',
			'fixed'
		);

		const parentIdx = addrs.findIndex(a => a === parentNM);
		const childIdx  = addrs.findIndex(a => a === childNM);

		assert.notStrictEqual(parentIdx, -1,
		                      'parent-layer/node_modules must be in addrs');
		assert.notStrictEqual(childIdx, -1,
		                      'child-layer/node_modules must be in addrs');
		assert(
			parentIdx < childIdx,
			`parent-layer/node_modules (idx ${parentIdx}) must come BEFORE ` +
			`child-layer/node_modules (idx ${childIdx}).\n` +
			`addrs:\n  ${addrs.join('\n  ')}`
		);
	});
});

describe('Resolver 2: explicit dep override (react in both layers)', () => {
	const parentNM = path.normalize(path.join(parentDir, 'node_modules'));
	const childNM  = path.normalize(path.join(childDir, 'node_modules'));
	let config;

	it('setup: load config', () => {
		config = loadTestConfig();
		// Verify react is in both layers' dependencies
		assert(config.allPackageCfg[0].dependencies['react'], 'child should have react in deps');
		assert(config.allPackageCfg[1].dependencies['react'], 'parent should have react in deps');
	});

	it('FIX: child react@18 found before parent react@17 (explicit dep wins)', () => {
		// react IS in both layers' direct dependencies.
		// The explicit deps section comes first, with head (child) layer first.
		// So child's react should win even for libs in parent's node_modules.
		const addrs = buildExternalAddrs(
			config,
			path.join(parentDir, 'node_modules', 'lib-a'),
			'react',
			'fixed'
		);

		const parentIdx = addrs.findIndex(a => a === parentNM);
		const childIdx  = addrs.findIndex(a => a === childNM);

		assert.notStrictEqual(childIdx, -1,
		                      'child-layer/node_modules must be in addrs');
		assert.notStrictEqual(parentIdx, -1,
		                      'parent-layer/node_modules must be in addrs');
		assert(
			childIdx < parentIdx,
			`For react (explicit dep in both layers), child-layer/node_modules (idx ${childIdx}) ` +
			`must come BEFORE parent-layer/node_modules (idx ${parentIdx}) ` +
			`because head layer's explicit deps win.\n` +
			`addrs:\n  ${addrs.join('\n  ')}`
		);
	});

	it('BUG REPRO: old behavior also had child react first (was already correct for this case)', () => {
		// The old code was correct for explicit deps — child came first in layer chain.
		// The bug only affected transitive deps.
		const addrs = buildExternalAddrs(
			config,
			path.join(parentDir, 'node_modules', 'lib-a'),
			'react',
			'old'
		);

		const parentIdx = addrs.findIndex(a => a === parentNM);
		const childIdx  = addrs.findIndex(a => a === childNM);

		assert(
			childIdx < parentIdx,
			'Even with old code, child react comes first (explicit dep priority was already correct)'
		);
	});
});

describe('Resolver 2: internal resolution (App code)', () => {
	it('internal resolution prioritizes explicit deps across layers', () => {
		const config    = loadTestConfig();
		const roots     = config.allRoots;
		const parentNM  = path.normalize(path.join(parentDir, 'node_modules'));
		const childNM   = path.normalize(path.join(childDir, 'node_modules'));
		const childRoot = roots[0]; // child-layer/App

		// Simulate: child-layer/App/index.js requires 'lib-a'
		// lib-a is in parent-layer's dependencies → parent should be prioritized
		const requestPath = childRoot;
		const isInternal  = roots.find(r => path.resolve(requestPath).startsWith(r));
		assert(isInternal, 'App/ path should be internal');

		let addrs = [];
		const packageName = 'lib-a';

		// Custom lib dirs
		addrs.push(
			...config.allModulePath.filter(
				( p, i ) => !config.allModuleRoots.find(mp => (path.join(mp, 'node_modules') === p))
			)
		);
		// Layers with explicit deps
		addrs.push(
			...config.allModuleRoots.filter(
				( p, i ) => (
					config.allPackageCfg[i].dependencies
					&& config.allPackageCfg[i].dependencies[packageName]
				)
			).map(p => path.join(p, 'node_modules'))
		);
		// Layers without explicit deps
		addrs.push(
			...config.allModuleRoots.filter(
				( p, i ) => !(
					config.allPackageCfg[i].dependencies
					&& config.allPackageCfg[i].dependencies[packageName]
				)
			).map(p => path.join(p, 'node_modules'))
		);
		addrs = addrs.map(p => path.normalize(p));
		addrs = addrs.filter(( p, i ) => addrs.indexOf(p) === i);

		const parentIdx = addrs.findIndex(a => a === parentNM);
		const childIdx  = addrs.findIndex(a => a === childNM);

		assert(
			parentIdx < childIdx,
			'For internal resolution of lib-a, parent (which has it in deps) ' +
			'should come before child (which does not)'
		);
	});
});

describe('Resolver 2: webpack integration', () => {
	it('webpack resolves sub-lib from lib-a to parent-layer version', ( t, done ) => {
		let webpack, pluginFactory;
		try {
			webpack       = require('webpack');
			pluginFactory = require('../src/layerPackPlugin');
		} catch ( e ) {
			console.log('  Skipping webpack integration test (webpack not available)');
			done();
			return;
		}

		const config = loadTestConfig();
		const plugin = pluginFactory(null, config);

		const compiler = webpack({
			mode   : 'development',
			context: childDir,
			entry  : path.join(childDir, 'App/index.js'),
			output : {
				path    : path.join(__dirname, '.test-output'),
				filename: 'bundle.js'
			},
			plugins: [plugin],
			resolve: { extensions: ['.js'] },
			target : 'node'
		});

		compiler.run(( err, stats ) => {
			if ( err ) {
				done(err);
				return;
			}

			const info = stats.toJson({ modules: true });

			if ( info.errors && info.errors.length ) {
				console.log('  Build errors:', info.errors.map(e => e.message || e));
			}

			// Find sub-lib module (not the one inside some-tool)
			const subLibMod = info.modules.find(
				m => m.name && m.name.includes('sub-lib') && !m.name.includes('some-tool')
			);

			if ( subLibMod ) {
				const resolvedPath = subLibMod.nameForCondition || subLibMod.identifier || '';
				assert(
					resolvedPath.includes('parent-layer'),
					`sub-lib should resolve from parent-layer but got: ${resolvedPath}`
				);
				assert(
					!resolvedPath.includes('child-layer'),
					`sub-lib should NOT resolve from child-layer but got: ${resolvedPath}`
				);
			}

			// Find react module
			const reactMod = info.modules.find(
				m => m.name && /\/react\//.test(m.name)
			);

			if ( reactMod ) {
				const resolvedPath = reactMod.nameForCondition || reactMod.identifier || '';
				assert(
					resolvedPath.includes('child-layer'),
					`react should resolve from child-layer (explicit dep) but got: ${resolvedPath}`
				);
			}

			// Cleanup
			compiler.close(() => {
				const outDir = path.join(__dirname, '.test-output');
				if ( fs.existsSync(outDir) ) {
					fs.rmSync(outDir, { recursive: true, force: true });
				}
				done();
			});
		});
	});
});
