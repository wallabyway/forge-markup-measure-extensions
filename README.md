## Building Measure/Markup extensions

public 'mirror' version of forge viewer markup and measure extensions 


### Setup

1. install cmd line...

``` 
npm install webpack
npm install css-loader --save-dev
npm install style-loader --save-dev

npm install svg-url-loader --save-dev
npm install mini-css-extract-plugin --save-dev
npm install optimize-css-assets-webpack-plugin --save-dev
npm install copy-webpack-plugin --save-dev
npm install merge-jsons-webpack-plugin --save-dev
```


## Compile
`webpack --config=webpack.js --env.BUILD_TASK=lmv-extensions --env.BUILD_PROD=true`

this will create minified extensions:

```
build/measure/measure.min.js
build/markup/markup.min.js

```

## Run
which you can include in your index.html file, like this:

```
<script src="measure.min.js"></script>
<script src="markup.min.js"></script>
```