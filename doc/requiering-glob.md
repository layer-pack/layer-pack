<h1 align="center">webpack-inherit</h1>
<h1></h1>
<h2 align="center">Using glob imports & require</h1>


## Syntax & behavior

#### ES6+

Given this theoretical source tree : 
```
App
│
└───pets
    └───dogManagement
    │   │   foodManager.js
    │   └── gameManager.js
    └───catManagement
        │   foodManager.js
        └── gameManager.js
```

```jsx
export { default as allCodeTree } from "App/pets/(**/*).js"

export allFoodMngrs from "App/pets/(*)/foodManager.js"
export allGameMngrs from "App/pets/(*)/gameManager.js"
```
