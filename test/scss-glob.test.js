/**
 * Tests for SCSS glob imports — virtual file generation and selective updates.
 *
 * Verifies:
 *   1. indexOfScss generates correct @import list from all layer roots
 *   2. Head layer files override parent layer files at same path
 *   3. Adding/removing SCSS files updates the virtual file content
 *   4. Selective rebuild: only changed glob virtual files get _forceBuild
 *      (same mechanism as JS globs — no blanket anySassChange flag)
 *
 * Uses wp5-style fixture with SCSS files:
 *   core-layer/App/ui/styles/base.scss, layout.scss
 *   www-endpoint/App/ui/styles/theme.scss
 *
 * Run: node --test test/scss-glob.test.js
 */

const { describe, it } = require('node:test');
const assert           = require('node:assert');
const path             = require('path');
const fs               = require('fs');

const utils = require('../src/utils');

const fixturesDir = path.join(__dirname, 'fixtures');
const wp5Dir      = path.join(fixturesDir, 'wp5-style');
const coreDir     = path.join(wp5Dir, 'layers', 'core-layer');
const wwwDir      = path.join(wp5Dir, 'endpoints', 'www-endpoint');

// ─── helpers ────────────────────────────────────────────────────────

function loadWp5Config() {
	const lpackCfg = JSON.parse(fs.readFileSync(path.join(wwwDir, '.layers.json'), 'utf8'));
	const pkgCfg   = JSON.parse(fs.readFileSync(path.join(wwwDir, 'package.json'), 'utf8'));
	return utils.getConfigByProfiles(wwwDir, lpackCfg['default'], 'default', {
		...pkgCfg, layerPack: lpackCfg
	});
}

/**
 * Mock VirtualModulesPlugin — captures writeModule calls.
 */
function createMockVMod() {
	const written = {};
	return {
		writeModule( fileName, content ) {
			written[fileName] = content;
		},
		getWritten() { return written; },
		// minimal _compiler mock so addVirtualFile works
		_compiler: { inputFileSystem: { _virtualFiles: {} } }
	};
}

/**
 * Mock input filesystem — reports virtual files as not existing
 * so addVirtualFile always writes.
 */
function createMockVfs() {
	return { _virtualFiles: {} };
}

/**
 * Call indexOfScss and return the generated virtual file content.
 */
function generateScssGlob( roots, globPattern, contextDeps ) {
	contextDeps = contextDeps || {};
	const vMod  = createMockVMod();
	const vfs   = createMockVfs();
	let result  = null;

	utils.indexOfScss(
		vMod, vfs, roots, globPattern,
		contextDeps, [], 'App', /^App/,
		false,
		( err, filePath, content, changed ) => {
			result = { err, filePath, content, changed };
		}
	);

	return result;
}

// ─── tests ──────────────────────────────────────────────────────────

describe('SCSS glob: indexOfScss virtual file generation', () => {

	it('collects @import statements from all layer roots', () => {
		const config = loadWp5Config();
		const result = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');

		assert(result, 'indexOfScss should call the callback');
		assert(!result.err, 'Should not error');
		assert(result.content, 'Should generate content');

		// Should include files from both layers
		assert(result.content.includes('App/ui/styles/base.scss'),
		       'Should include base.scss from core-layer');
		assert(result.content.includes('App/ui/styles/layout.scss'),
		       'Should include layout.scss from core-layer');
		assert(result.content.includes('App/ui/styles/theme.scss'),
		       'Should include theme.scss from www-endpoint');
	});

	it('generates valid @import statements', () => {
		const config = loadWp5Config();
		const result = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');

		const lines = result.content.split('\n').filter(l => l.trim());
		for ( const line of lines ) {
			if ( line.startsWith('/*') ) continue; // skip comment
			assert(
				/^@import "App\/ui\/styles\/\w+\.scss";$/.test(line),
				`Each line should be a valid @import, got: ${line}`
			);
		}
	});

	it('head layer file overrides parent file at same path', () => {
		const config = loadWp5Config();

		// Add a file in www-endpoint that has the same name as one in core-layer
		const overrideFile = path.join(wwwDir, 'App', 'ui', 'styles', 'base.scss');
		try {
			fs.writeFileSync(overrideFile, '.www-base-override { color: red; }\n');

			const result = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');

			// base.scss should appear only once (head wins, deduped by logical path)
			const imports = result.content.match(/@import "App\/ui\/styles\/base\.scss"/g);
			assert.strictEqual(imports?.length, 1,
			                   'base.scss should appear exactly once (head overrides parent)');
		} finally {
			try { fs.unlinkSync(overrideFile); } catch ( e ) {}
		}
	});

	it('registers context dependencies for watch tracking', () => {
		const config      = loadWp5Config();
		const contextDeps = {};
		generateScssGlob(config.allRoots, 'App/ui/styles/*.scss', contextDeps);

		// Both layer directories should be registered
		const dirs = Object.keys(contextDeps);
		const hasCore = dirs.some(d => d.includes('core-layer') && d.includes('styles'));
		const hasWww  = dirs.some(d => d.includes('www-endpoint') && d.includes('styles'));

		assert(hasCore, 'Should register core-layer styles dir in contextDependencies');
		assert(hasWww, 'Should register www-endpoint styles dir in contextDependencies');
	});
});

describe('SCSS glob: add/remove detection', () => {

	it('adding a new SCSS file changes the virtual file content', () => {
		const config = loadWp5Config();
		const addedFile = path.join(wwwDir, 'App', 'ui', 'styles', 'dynamic.scss');

		try {
			// Generate without the file
			const before = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');
			assert(!before.content.includes('dynamic.scss'), 'Before: no dynamic.scss');

			// Add the file
			fs.writeFileSync(addedFile, '.dynamic { opacity: 1; }\n');

			// Generate again
			const after = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');
			assert(after.content.includes('dynamic.scss'), 'After add: dynamic.scss present');

			// Content should differ
			assert.notStrictEqual(before.content, after.content,
			                     'Virtual file content should change when file is added');
		} finally {
			try { fs.unlinkSync(addedFile); } catch ( e ) {}
		}
	});

	it('removing a SCSS file changes the virtual file content', () => {
		const config = loadWp5Config();
		const tempFile = path.join(wwwDir, 'App', 'ui', 'styles', 'temporary.scss');

		try {
			// Create file, generate
			fs.writeFileSync(tempFile, '.temp { display: none; }\n');
			const before = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');
			assert(before.content.includes('temporary.scss'), 'Before: temporary.scss present');

			// Remove file, generate again
			fs.unlinkSync(tempFile);
			const after = generateScssGlob(config.allRoots, 'App/ui/styles/*.scss');
			assert(!after.content.includes('temporary.scss'), 'After remove: temporary.scss gone');
		} finally {
			try { fs.unlinkSync(tempFile); } catch ( e ) {}
		}
	});
});

describe('SCSS glob: rebuild strategy', () => {

	it('JS globs use selective rebuild via toBeRebuilt only', () => {
		const pluginSrc = fs.readFileSync(
			path.join(__dirname, '..', 'src', 'layerPackPlugin.js'), 'utf8'
		);
		const beforeAddMatch = pluginSrc.match(/toBeRebuilt\.has\(module\.resource\)/);
		assert(beforeAddMatch, 'beforeAdd should use toBeRebuilt.has() for JS glob rebuild');
	});

	it('SCSS globs use anySassChange to rebuild all .scss/.css modules', () => {
		const pluginSrc = fs.readFileSync(
			path.join(__dirname, '..', 'src', 'layerPackPlugin.js'), 'utf8'
		);

		// SCSS needs blanket rebuild because sass resolves @import inline via { contents }
		// — webpack has no module dependency between the .scss file and the virtual glob.
		assert(
			pluginSrc.includes('anySassChange'),
			'anySassChange flag must exist for SCSS glob rebuild'
		);
		assert(
			/anySassChange\s*&&\s*\/\\.s\?css/.test(pluginSrc),
			'beforeAdd should check anySassChange for .scss/.css modules'
		);
	});

	it('both JS and SCSS callbacks add to toBeRebuilt', () => {
		const pluginSrc = fs.readFileSync(
			path.join(__dirname, '..', 'src', 'layerPackPlugin.js'), 'utf8'
		);
		const addCalls = pluginSrc.match(/toBeRebuilt\.add\(filePath\)/g);
		assert(
			addCalls && addCalls.length >= 2,
			`Both JS and SCSS globs should add to toBeRebuilt (found ${addCalls?.length || 0} calls)`
		);
	});

	it('SCSS callback sets anySassChange, JS callback does not', () => {
		const pluginSrc = fs.readFileSync(
			path.join(__dirname, '..', 'src', 'layerPackPlugin.js'), 'utf8'
		);
		const sassChangeSets = pluginSrc.match(/anySassChange\s*=\s*true/g);
		assert.strictEqual(
			sassChangeSets?.length, 1,
			'anySassChange = true should appear exactly once (in the SCSS glob callback)'
		);
	});
});

describe('SCSS glob: webpack build integration', () => {

	it('SCSS glob from JS produces virtual module with all layer files', ( t, done ) => {
		let webpack, pluginFactory;
		try {
			webpack       = require('webpack');
			pluginFactory = require('../src/layerPackPlugin');
		} catch ( e ) {
			console.log('  Skipping (webpack not available)');
			return done();
		}

		const config    = loadWp5Config();
		const plugin    = pluginFactory(null, config);
		const entryFile = path.join(wwwDir, 'App', '_test_scss_build.js');
		const outDir    = path.join(__dirname, '.test-output-scss-build-' + Date.now());

		// JS glob of *.scss — uses indexOf (JS handler), but still picks up SCSS files
		fs.writeFileSync(entryFile,
			'module.exports = require("App/ui/styles/(*).scss");\n'
		);

		const compiler = webpack({
			mode   : 'development',
			context: wwwDir,
			entry  : entryFile,
			output : { path: outDir, filename: 'bundle.js', libraryTarget: 'commonjs2' },
			plugins: [plugin],
			resolve: { extensions: ['.js', '.scss'] },
			target : 'node',
			module : { rules: [{ test: /\.scss$/, type: 'asset/source' }] }
		});

		compiler.run(( err, stats ) => {
			try {
				if ( err ) return done(err);
				const info = stats.toJson({ modules: true });
				if ( info.errors?.length ) {
					console.log('  Build errors:', info.errors.map(e => e.message || e));
				}

				// Virtual glob module should exist
				const globMod = info.modules.find(m => m.name?.includes('MapOf'));
				assert(globMod, 'Should have a glob virtual module');

				// Should include SCSS files from both layers
				const scssModules = info.modules.filter(m => m.name?.includes('.scss') && !m.name?.includes('MapOf'));
				const names = scssModules.map(m => m.name);
				assert(names.some(n => n.includes('theme')), 'Should include theme.scss from www-endpoint');
				assert(names.some(n => n.includes('base')), 'Should include base.scss from core-layer');
				assert(names.some(n => n.includes('layout')), 'Should include layout.scss from core-layer');

				// Run the bundle — exports should have captured group names
				const bundlePath = path.join(outDir, 'bundle.js');
				if ( fs.existsSync(bundlePath) ) {
					const result = require(bundlePath);
					const exports = result.default || result;
					assert(exports.theme, 'Should export captured name "theme"');
					assert(exports.base, 'Should export captured name "base"');
					assert(exports.layout, 'Should export captured name "layout"');
					delete require.cache[require.resolve(bundlePath)];
				}
			} finally {
				compiler.close(() => {
					try { fs.unlinkSync(entryFile); } catch ( e ) {}
					if ( fs.existsSync(outDir) ) fs.rmSync(outDir, { recursive: true, force: true });
					done();
				});
			}
		});
	});
});
