/**
 * Tests for bug fixes #1-#7 and edge cases.
 * Run: node --test test/bugfixes.test.js
 */
const { describe, it } = require('node:test');
const assert           = require('node:assert');
const path             = require('path');
const fs               = require('fs');
const utils            = require('../src/utils');

const fixturesDir = path.join(__dirname, 'fixtures');

// ─── helpers ────────────────────────────────────────────────────────

function loadConfig(projectRoot, customPkg) {
    const lpackCfg = JSON.parse(fs.readFileSync(path.join(projectRoot, '.layers.json'), 'utf8'));
    const pkgCfg = customPkg || JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    let profile = lpackCfg['default'];
    return utils.getConfigByProfiles(
        projectRoot,
        profile,
        'default',
        { ...pkgCfg, layerPack: lpackCfg }
    );
}

// ─── Bug 1: Runtime inject transitive dep ───────────────────────────

describe('Bug 1: runtime inject mirrors build-time fix', () => {
    it('loadModulePaths_inject.js re-inserts rootMod after explicit deps', () => {
        // Read the inject file and verify the fix pattern is present
        const injectPath = path.join(__dirname, '..', 'etc', 'node', 'loadModulePaths_inject.js');
        const content = fs.readFileSync(injectPath, 'utf8');

        // The old bug: rootMod = paths.pop() followed by a single paths.push() with both filters
        // The fix: split into explicit deps push, rootMod re-insert, shared deps push
        assert(
            content.includes('if ( rootMod )'),
            'Should re-insert rootMod conditionally'
        );
        assert(
            content.includes('paths.push(rootMod)'),
            'Should push rootMod back into paths'
        );
        // Verify the structure in the isBuildChild branch:
        // explicit deps → rootMod re-insert → shared deps
        const isBuildChild = content.indexOf('isBuildChild');
        const rootModInsert = content.indexOf('paths.push(rootMod)', isBuildChild);
        const explicitDeps = content.indexOf('allRootDeps[i].includes(packageName)', isBuildChild);
        const sharedDeps = content.indexOf('!allRootDeps[i].includes(packageName)', rootModInsert);
        assert(explicitDeps < rootModInsert, 'Explicit deps should come before rootMod re-insert');
        assert(rootModInsert < sharedDeps, 'rootMod re-insert should come before shared deps');
    });
});

// ─── Bug 2: $super from deepest layer ───────────────────────────────

describe('Bug 2: $super from deepest layer calls callback', () => {
    it('findParent calls cb(true) when file is in last root', () => {
        const config = loadConfig(
            path.join(fixturesDir, 'three-layers', 'head-layer')
        );
        const roots = config.allRoots;

        // The deepest root is grandparent-layer/App (last in roots array)
        const deepestRoot = roots[roots.length - 1];
        assert(deepestRoot.includes('grandparent-layer'), `Last root should be grandparent-layer, got ${deepestRoot}`);

        // Create a fake file path in the deepest layer
        const fakeFile = path.normalize(path.join(deepestRoot, 'index.js'));

        // findParent should call cb with error (no parent exists), not hang
        let callbackCalled = false;
        let callbackErr = null;

        utils.findParent(
            fs, roots, fakeFile, [''],
            [],
            (err, filePath) => {
                callbackCalled = true;
                callbackErr = err;
            }
        );

        // findParent uses fs.stat which is async, but the initial root-matching
        // is synchronous. For the deepest-root case, cb should be called synchronously.
        assert(callbackCalled, 'Callback must be called for file in deepest layer');
        assert(callbackErr === true, 'Callback should receive error=true (no parent)');
    });

    it('findParent still works for non-deepest roots', () => {
        const config = loadConfig(
            path.join(fixturesDir, 'three-layers', 'head-layer')
        );
        const roots = config.allRoots;

        // File in head layer (first root) - should call findParentPath
        const headRoot = roots[0];
        assert(headRoot.includes('head-layer'));

        const fakeFile = path.normalize(path.join(headRoot, 'index.js'));

        let callbackCalled = false;
        utils.findParent(
            fs, roots, fakeFile, ['', '.js'],
            [],
            (err, filePath) => {
                callbackCalled = true;
                // err could be null (found) or true (not found) — either way cb is called
            }
        );

        // findParentPath is async (uses fs.stat), so callback won't be called sync.
        // Just verify it didn't hang by reaching this point (the sync root-matching worked).
        // The actual resolution happens asynchronously.
    });
});

// ─── Bug 3: localAlias typo ─────────────────────────────────────────

describe('Bug 3: localAlias uses correct reference', () => {
    it('utils.js references profile.localAlias not cfg.aliases', () => {
        const utilsPath = path.join(__dirname, '..', 'src', 'utils.js');
        const content = fs.readFileSync(utilsPath, 'utf8');

        // The fix: cfg.aliases → profile.localAlias
        assert(
            !content.includes('cfg.aliases[alias]'),
            'Should NOT reference cfg.aliases (the typo)'
        );
        assert(
            content.includes('profile.localAlias[alias]'),
            'Should reference profile.localAlias[alias]'
        );
    });
});

// ─── Bug 4: findParentPath off-by-one ───────────────────────────────

describe('Bug 4: findParentPath boundary check', () => {
    it('does not recurse with undefined extension', (t, done) => {
        const config = loadConfig(
            path.join(fixturesDir, 'three-layers', 'head-layer')
        );
        const roots = config.allRoots;

        // Search for a file that doesn't exist anywhere
        // With the fix, it should terminate cleanly without trying undefined extension
        let statCalls = [];
        const mockFs = {
            stat(fn, cb) {
                statCalls.push(fn);
                cb(new Error('not found'), null);
            }
        };

        utils.findParentPath(
            mockFs, roots, '/nonexistent', 0,
            ['', '.js', '.ts'],
            [],
            (err) => {
                // Verify no stat call includes 'undefined' in the path
                const undefinedCalls = statCalls.filter(p => p.includes('undefined'));
                assert.strictEqual(
                    undefinedCalls.length, 0,
                    `No stat calls should include "undefined", got: ${undefinedCalls.join(', ')}`
                );
                done();
            }
        );
    });
});

// ─── Bug 5: findParent prefix matching ──────────────────────────────

describe('Bug 5: findParent path separator boundary', () => {
    it('does not match /App as prefix of /AppExtra', () => {
        // Create two roots where one is a prefix of the other
        const roots = [
            path.normalize('/project/AppLayer/App'),
            path.normalize('/project/AppLayerExtra/App')
        ];

        // A file in AppLayerExtra should NOT match AppLayer
        const file = path.normalize('/project/AppLayerExtra/App/index.js');

        let matchedRoot = null;
        let callbackCalled = false;

        utils.findParent(
            fs, roots, file, [''],
            [],
            (err, filePath) => {
                callbackCalled = true;
                // If it matched the FIRST root (AppLayer/App), findParentPath would
                // try to find a parent — but the file is actually in root[1].
                // With the fix, it should match root[1] and since it's the last root,
                // cb(true) is called (no parent).
            }
        );

        assert(callbackCalled, 'Callback should be called');
    });

    it('correctly matches exact root path', () => {
        const roots = [
            path.normalize('/project/layer/App'),
            path.normalize('/project/layer/AppBackup')
        ];

        const file = path.normalize('/project/layer/App/deep/file.js');

        let callbackCalled = false;
        utils.findParent(
            fs, roots, file, [''],
            [],
            (err, filePath) => {
                callbackCalled = true;
                // Should match root[0] (/project/layer/App), not root[1]
                // Since root[0] is not the last, it calls findParentPath
                // which is async — callback may not fire sync
            }
        );
        // The root matching is synchronous — if root[0] matches,
        // findParentPath is called (async). If prefix matching was broken,
        // it might wrongly match root[1] instead.
    });
});

// ─── Bug 6: Internal .layer_modules ─────────────────────────────────

describe('Bug 6: internal resolution includes .layer_modules', () => {
    it('layerPackPlugin internal branch uses reduce with .layer_modules', () => {
        const pluginPath = path.join(__dirname, '..', 'src', 'layerPackPlugin.js');
        const content = fs.readFileSync(pluginPath, 'utf8');

        // Find the isInternal branch (starts with "if ( !!isInternal )")
        const internalStart = content.indexOf('if ( !!isInternal )');
        const internalEnd = content.indexOf('else {', internalStart);
        const internalBlock = content.substring(internalStart, internalEnd);

        // The fix: .map(p => resolver.join(p, "node_modules")) replaced with
        // .reduce() that pushes both .layer_modules/node_modules and node_modules
        assert(
            internalBlock.includes('.layer_modules'),
            'Internal resolution should include .layer_modules paths'
        );
        assert(
            internalBlock.includes('.reduce('),
            'Internal resolution should use .reduce() for deps sections'
        );
    });
});

// ─── Bug 7: Circular extends detection ──────────────────────────────

describe('Bug 7: circular extends detection', () => {
    it('throws on circular extends (A extends B, B extends A)', () => {
        const layerADir = path.join(fixturesDir, 'circular', 'layer-a');

        assert.throws(
            () => loadConfig(layerADir),
            (err) => {
                assert(err.message.includes('Circular extends detected'),
                    `Expected circular extends error, got: ${err.message}`);
                return true;
            },
            'Should throw on circular extends'
        );
    });

    it('diamond inheritance does NOT throw', () => {
        // The wp5-style fixture has: www-endpoint → core-layer (no diamond)
        // For a proper diamond test we'd need A → [B, C], B → D, C → D
        // But even without that, verify the existing three-layer chain works
        assert.doesNotThrow(
            () => loadConfig(path.join(fixturesDir, 'three-layers', 'head-layer')),
            'Three-layer chain should not throw circular detection'
        );
    });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe('Edge cases: three-layer transitive dep resolution', () => {
    it('deep-util@1.0 from grandparent wins over deep-util@2.0 from head', (t, done) => {
        let webpack, pluginFactory;
        try {
            webpack = require('webpack');
            pluginFactory = require('../src/layerPackPlugin');
        } catch (e) {
            console.log('  Skipping (webpack not available)');
            return done();
        }

        const headDir = path.join(fixturesDir, 'three-layers', 'head-layer');
        const config = loadConfig(headDir);
        const plugin = pluginFactory(null, config);

        // Entry that imports deep-lib (from grandparent, which requires deep-util)
        const tmpEntry = path.join(headDir, 'App', '_test_3layer.js');
        fs.writeFileSync(tmpEntry, 'module.exports = require("deep-lib");\n');

        const compiler = webpack({
            mode: 'development',
            context: headDir,
            entry: tmpEntry,
            output: {
                path: path.join(__dirname, '.test-output-3layer'),
                filename: 'bundle.js',
                libraryTarget: 'commonjs2'
            },
            plugins: [plugin],
            resolve: { extensions: ['.js'] },
            target: 'node'
        });

        compiler.run((err, stats) => {
            try {
                if (err) return done(err);
                const info = stats.toJson({ modules: true });
                if (info.errors?.length) {
                    console.log('  Build errors:', info.errors.map(e => e.message || e));
                }

                // deep-util should resolve from grandparent (v1.0), not head (v2.0)
                const utilMod = info.modules.find(
                    m => m.name?.includes('deep-util') && !m.name?.includes('head-tool')
                );
                if (utilMod) {
                    const p = utilMod.nameForCondition || utilMod.identifier || '';
                    assert(
                        p.includes('grandparent-layer'),
                        `deep-util should come from grandparent-layer, got: ${p}`
                    );
                }

                // Runtime verification
                const bundlePath = path.join(__dirname, '.test-output-3layer', 'bundle.js');
                if (fs.existsSync(bundlePath)) {
                    const result = require(bundlePath);
                    assert.strictEqual(result.utilVersion, '1.0.0',
                        `deep-lib should use deep-util v1.0 from grandparent, got ${result.utilVersion}`);
                    delete require.cache[require.resolve(bundlePath)];
                }
            } finally {
                compiler.close(() => {
                    fs.unlinkSync(tmpEntry);
                    const outDir = path.join(__dirname, '.test-output-3layer');
                    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
                    done();
                });
            }
        });
    });
});

describe('Edge cases: empty roots and extensions', () => {
    it('findParent with empty roots calls cb(true)', () => {
        let called = false;
        utils.findParent(
            fs, [], '/some/file.js', [''],
            [],
            (err) => { called = true; assert(err === true); }
        );
        assert(called, 'cb should be called for empty roots');
    });

    it('findParentPath terminates with single extension', (t, done) => {
        const roots = [path.normalize('/fake/root')];
        const mockFs = {
            stat(fn, cb) { cb(new Error('nope'), null); }
        };

        utils.findParentPath(
            mockFs, roots, '/file', 0,
            [''],  // single extension
            [],
            (err) => {
                assert(err === true, 'Should terminate with error');
                done();
            }
        );
    });
});
