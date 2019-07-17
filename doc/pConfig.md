<h1 align="center">webpack-inherit</h1>
<h1></h1>

Add a ".wi.json" file near the package.json :

```jsx
{
   		"default": {// default profile id

   		    // local root that will be mapped on App/...
   			"rootFolder": "App",

   			// optional list of templates folder to init an app / comp
   			"templates": {
   			    "default":"./templates/ssrApp",
   			    "ssrApp":"./templates/ssrApp"
   			},
   			"extend"    : [
   				"parentProject" // parentProject must have wpInherit.default with his own extend value & be in node_modules or in "libsPath" value
   			]
   		},
   		// optionally we can define multiple profile
   		"api"    : {// same profiles must exist in all inherited project
   			"rootFolder": "App",

   			// optional folder containing libs overrides for dev purposes
   			// ( these libs will have precedence over node_modules )
   			//
   			// /!\ Use this to hard patch bugged npm libs or add work in progress libs /!\
   			// /!\ should not be used unless there no other solutions /!\
   			// /!\ (& overrided lib version must be fixed) /!\
   			"libsPath": "./libs",

   			// optional webpack config
   			"config"    : "./webpack.config.api.js",

   			"extend"    : [
   				"parentProject"
   			]
   		},
   		// optionally we can define profile with some wp config overrides
   		"Comp"   : {
   			"config": "./webpack.config.www.js",

   			// optional profile id to use in the inherited packages
   			"basedOn": "someSuperProfile_in_parents",

   			// optional vars
   			"vars"  : {
   				// all @optional

   				// override the root folder alias ( default to "App" )
   				// So all inner build inheritable files will be requierable using require("Comp/some/stuff")
   				"rootAlias"   : "MyApp",

   				// make anything outside the inheritable folder external
   				// ( for nodes builds & components )
   				// * this could be a RegExp like "^(?!react|@babel)" but packed libs can require externalized
   				"externals"   : true,

   				// all theses values are available in the webpack config using wpiCfg.vars.*
   			},
   			"extend": [
   				"parentProject"
   			]
   		}
}
```
