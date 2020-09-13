/*
 * The MIT License (MIT)
 * Copyright (c) 2019. Wise Wild Web
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 *  @author : Nathanael Braun
 *  @contact : n8tz.js@gmail.com
 */
( function () {
    let Module         = require('module').Module,
        path           = require('path'),
        modPath        = [],
        allRoots       = [],
        baseDir        = false,
        rootModule     = module,
        __initialPaths = [].concat(rootModule.paths),
        __oldNMP       = Module._nodeModulePaths;
    
    
    Module._nodeModulePaths = function ( from ) {
        let paths;
        if (
            from === baseDir
            ||
            allRoots.find(path => ( from.substr(0, path.length) === path ))
        ) {
            paths = [].concat(modPath).concat(__oldNMP(from)).filter(function ( el, i, arr ) {
                return arr.indexOf(el) === i;
            });
            return paths;
        }
        else {
            if ( !baseDir )
                return [...__oldNMP(from), ...modPath];
            return [path.join(from, 'node_modules'), path.resolve(from, '..'), ...modPath, ...__oldNMP(from)];
        }
    };
    
    return function loadPaths( { allModulePath, cDir }, dist ) {
        modPath = allModulePath.map(p => path.join(cDir, p));
        baseDir = path.join(cDir, dist);
        
        rootModule.paths.length = 0;
        rootModule.paths.push(...modPath, ...__initialPaths);
    }
} )