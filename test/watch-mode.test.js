/**
 * Tests for webpack --watch (live code update) behavior.
 *
 * Exercises the full watch/rebuild lifecycle:
 *   1. Initial build with glob imports → virtual file generated
 *   2. Add a new file to a layer root → glob re-scanned, virtual file updated,
 *      webpack rebuilds with new file included
 *   3. Remove that file → glob re-scanned, virtual file updated,
 *      webpack rebuilds without it
 *   4. Add a file in parent layer → inherited via glob
 *   5. Modify an existing file referenced by glob → content change detected
 *   6. Non-glob files: modify a regular file → webpack detects and rebuilds
 *
 * Uses the wp5-style fixture:
 *   layers/core-layer/App/ui/comps/CoreComp.js
 *   endpoints/www-endpoint/App/ui/comps/FooBar.js, FooBtn.js
 *
 * Run: node --test --test-timeout 60000 test/watch-mode.test.js
 */

const { describe, it } = require('node:test');
const assert           = require('node:assert');
const path             = require('path');
const fs               = require('fs');

const fixturesDir = path.join(__dirname, 'fixtures');
const wp5Dir      = path.join(fixturesDir, 'wp5-style');
const coreDir     = path.join(wp5Dir, 'layers', 'core-layer');
const wwwDir      = path.join(wp5Dir, 'endpoints', 'www-endpoint');

let webpack, pluginFactory;
try {
	webpack       = require('webpack');
	pluginFactory = require('../src/layerPackPlugin');
} catch ( e ) {
	// webpack not available — tests will be skipped below
}

// ─── helpers ────────────────────────────────────────────────────────

function loadWp5Config() {
	const utils    = require('../src/utils');
	const lpackCfg = JSON.parse(fs.readFileSync(path.join(wwwDir, '.layers.json'), 'utf8'));
	const pkgCfg   = JSON.parse(fs.readFileSync(path.join(wwwDir, 'package.json'), 'utf8'));
	let profile    = lpackCfg['default'];
	return utils.getConfigByProfiles(wwwDir, profile, 'default', { ...pkgCfg, layerPack: lpackCfg });
}

function createWatchCompiler( entryCode ) {
	const config    = loadWp5Config();
	const plugin    = pluginFactory(null, config);
	const entryFile = path.join(wwwDir, 'App', '_test_watch_entry.js');
	const outDir    = path.join(__dirname, '.test-output-watch-' + Date.now());

	fs.writeFileSync(entryFile, entryCode);

	const compiler = webpack({
		mode   : 'development',
		context: wwwDir,
		entry  : entryFile,
		output : {
			path         : outDir,
			filename     : 'bundle.js',
			libraryTarget: 'commonjs2'
		},
		plugins: [plugin],
		resolve: { extensions: ['.js'] },
		target : 'node',
		watchOptions: { aggregateTimeout: 100, poll: 200 }
	});

	return {
		compiler, entryFile, outDir,
		cleanup() {
			try { fs.unlinkSync(entryFile); } catch ( e ) {}
			try { if ( fs.existsSync(outDir) ) fs.rmSync(outDir, { recursive: true, force: true }); } catch ( e ) {}
		}
	};
}

function requireBundle( outDir ) {
	const bundlePath = path.join(outDir, 'bundle.js');
	delete require.cache[require.resolve(bundlePath)];
	return require(bundlePath);
}

function waitFor( fn, timeoutMs ) {
	timeoutMs = timeoutMs || 20000;
	return new Promise(( resolve, reject ) => {
		const timer = setTimeout(() => reject(new Error('Timed out after ' + timeoutMs + 'ms')), timeoutMs);
		fn(( ...args ) => {
			clearTimeout(timer);
			resolve(args);
		});
	});
}

/**
 * Start watching, wait for initial build, then return helpers to wait for
 * subsequent rebuild cycles.
 */
async function startWatching( compiler ) {
	let resolveNextBuild;
	let nextBuildPromise = new Promise(r => { resolveNextBuild = r; });
	let buildCount = 0;

	const [watcher, err, stats] = await waitFor(( done ) => {
		const w = compiler.watch({ aggregateTimeout: 100, poll: 200 }, ( err, stats ) => {
			buildCount++;
			if ( buildCount === 1 ) {
				done(w, err, stats);
			}
			else {
				resolveNextBuild({ err, stats });
			}
		});
	});

	return {
		watcher, err, stats,
		waitRebuild() {
			nextBuildPromise = new Promise(r => { resolveNextBuild = r; });
			return nextBuildPromise;
		},
		async close() {
			await waitFor(( done ) => watcher.close(done));
		}
	};
}

// ─── tests ──────────────────────────────────────────────────────────

describe('watch mode: glob add/remove cycle', () => {

	it('add a new comp → rebuild includes it → remove → rebuild excludes it', async ( t ) => {
		if ( !webpack ) { t.skip('webpack not available'); return; }

		const { compiler, outDir, cleanup } = createWatchCompiler(
			'module.exports = require("App/ui/comps/(*).js");\n'
		);
		const addedFile = path.join(wwwDir, 'App', 'ui', 'comps', 'DynComp.js');

		try {
			const watch = await startWatching(compiler);
			assert(!watch.err, 'Initial build should not error');

			// ── Initial: 3 comps ──
			let exports = (requireBundle(outDir)).default || requireBundle(outDir);
			assert(exports.CoreComp, 'Initial: CoreComp present');
			assert(exports.FooBar, 'Initial: FooBar present');
			assert(exports.FooBtn, 'Initial: FooBtn present');
			assert(!exports.DynComp, 'Initial: DynComp absent');

			// ── Add DynComp → rebuild ──
			const rebuildAdd = watch.waitRebuild();
			fs.writeFileSync(addedFile, 'module.exports = { name: "DynComp", dynamic: true };\n');
			await rebuildAdd;

			exports = (requireBundle(outDir)).default;
			assert(exports.DynComp, 'After add: DynComp present');
			assert.strictEqual(exports.DynComp.dynamic, true);
			assert(exports.CoreComp, 'After add: CoreComp still present');

			// ── Remove DynComp → rebuild ──
			const rebuildRm = watch.waitRebuild();
			fs.unlinkSync(addedFile);
			await rebuildRm;

			exports = (requireBundle(outDir)).default;
			assert(!exports.DynComp, 'After remove: DynComp gone');
			assert(exports.CoreComp, 'After remove: CoreComp still present');
			assert(exports.FooBar, 'After remove: FooBar still present');

			await watch.close();
		} finally {
			try { fs.unlinkSync(addedFile); } catch ( e ) {}
			cleanup();
		}
	});
});

describe('watch mode: parent layer file addition', () => {

	it('new file in core-layer is picked up by glob in head', async ( t ) => {
		if ( !webpack ) { t.skip('webpack not available'); return; }

		const { compiler, outDir, cleanup } = createWatchCompiler(
			'module.exports = require("App/ui/comps/(*).js");\n'
		);
		const parentFile = path.join(coreDir, 'App', 'ui', 'comps', 'ParentNew.js');

		try {
			const watch = await startWatching(compiler);

			let exports = (requireBundle(outDir)).default;
			assert(!exports.ParentNew, 'Initial: ParentNew absent');

			const rebuild = watch.waitRebuild();
			fs.writeFileSync(parentFile, 'module.exports = { name: "ParentNew", fromCore: true };\n');
			await rebuild;

			exports = (requireBundle(outDir)).default;
			assert(exports.ParentNew, 'After add in core: ParentNew present');
			assert.strictEqual(exports.ParentNew.fromCore, true);
			assert(exports.CoreComp, 'CoreComp still present');

			await watch.close();
		} finally {
			try { fs.unlinkSync(parentFile); } catch ( e ) {}
			cleanup();
		}
	});
});

describe('watch mode: modify existing glob-referenced file', () => {

	it('changing file content triggers rebuild with new value', async ( t ) => {
		if ( !webpack ) { t.skip('webpack not available'); return; }

		const { compiler, outDir, cleanup } = createWatchCompiler(
			'module.exports = require("App/ui/comps/(*).js");\n'
		);

		// Save original content to restore later
		const fooBarPath = path.join(wwwDir, 'App', 'ui', 'comps', 'FooBar.js');
		const origContent = fs.readFileSync(fooBarPath, 'utf8');

		try {
			const watch = await startWatching(compiler);

			let exports = (requireBundle(outDir)).default;
			assert.strictEqual(exports.FooBar?.name, 'FooBar');

			// Modify FooBar
			const rebuild = watch.waitRebuild();
			fs.writeFileSync(fooBarPath, 'module.exports = { name: "FooBar", modified: true };\n');
			await rebuild;

			exports = (requireBundle(outDir)).default;
			assert.strictEqual(exports.FooBar?.modified, true, 'After modify: FooBar has new content');

			await watch.close();
		} finally {
			// Restore original
			fs.writeFileSync(fooBarPath, origContent);
			cleanup();
		}
	});
});

describe('watch mode: non-glob regular file change', () => {

	it('modifying a regular imported file triggers rebuild', async ( t ) => {
		if ( !webpack ) { t.skip('webpack not available'); return; }

		const config    = loadWp5Config();
		const plugin    = pluginFactory(null, config);
		const entryFile = path.join(wwwDir, 'App', '_test_watch_regular.js');
		const depFile   = path.join(wwwDir, 'App', '_test_watch_dep.js');
		const outDir    = path.join(__dirname, '.test-output-watch-regular-' + Date.now());

		fs.writeFileSync(depFile, 'module.exports = { value: 1 };\n');
		fs.writeFileSync(entryFile, 'module.exports = require("./_test_watch_dep");\n');

		const compiler = webpack({
			mode   : 'development',
			context: wwwDir,
			entry  : entryFile,
			output : { path: outDir, filename: 'bundle.js', libraryTarget: 'commonjs2' },
			plugins: [plugin],
			resolve: { extensions: ['.js'] },
			target : 'node',
			watchOptions: { aggregateTimeout: 100, poll: 200 }
		});

		try {
			const watch = await startWatching(compiler);

			let result = requireBundle(outDir);
			assert.strictEqual(result.value, 1, 'Initial: value=1');

			// Modify dep file
			const rebuild = watch.waitRebuild();
			fs.writeFileSync(depFile, 'module.exports = { value: 42 };\n');
			await rebuild;

			result = requireBundle(outDir);
			assert.strictEqual(result.value, 42, 'After modify: value=42');

			await watch.close();
		} finally {
			try { fs.unlinkSync(entryFile); } catch ( e ) {}
			try { fs.unlinkSync(depFile); } catch ( e ) {}
			if ( fs.existsSync(outDir) ) fs.rmSync(outDir, { recursive: true, force: true });
		}
	});
});
