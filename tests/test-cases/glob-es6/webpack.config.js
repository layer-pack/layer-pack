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
const wpInherit         = require('webpack-inherit');
const HtmlWebpackPlugin = require('html-webpack-plugin');

wpInherit.loadConfig(
	{
		"default": {
			"rootFolder": "App",
			externals   : true // directly use wpi to exclude code outside of ./App/**/*.*
		}
	}
)

const isExcluded = wpInherit.isFileExcluded("default");

module.exports = [
	{
		mode: "development",
		
		// The jsx App entry point
		entry: {
			"myLib": ["App/index.js"]
		},
		
		// The resulting build
		output: {
			path         : __dirname + "/dist",
			filename     : "[name].js",
			publicPath   : "/",
			libraryTarget: "commonjs-module"
		},
		
		// add sourcemap in a dedicated file (.map)
		devtool: 'source-map',
		// Global build plugin & option
		plugins: [
			wpInherit.plugin("default"),
		],
		
		
		// the requirable files and what manage theirs parsing
		module: {
			rules: [
				{
					test   : /\.jsx?$/,
					exclude: isExcluded,
					use    : [
						{
							loader : 'babel-loader',
							options: {
								cacheDirectory: true, //important for performance
								presets       : [
									['@babel/preset-env'],
								],
								plugins       : []
							}
						},
					]
				},
			],
		},
	},
]