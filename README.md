## Building Measure/Markup extensions

This is a public 'mirror' version of forge viewer markup and measure extensions 

**Motivation:**
Forge customers want to modify existing markup and measure tools.

## Setup

1. install cmd line...

``` 
npm install webpack
npm install css-loader --save-dev
npm install style-loader --save-dev
npm install svg-url-loader --save-dev
```


## Compile
`webpack --config=webpack.js --env.BUILD_TASK=lmv-extensions --env.BUILD_PROD=true`

this will create minified files under `build/extensions/`:

```
Measure/Measure.min.js
Markup/Markup.min.js
```

## Run
which you can include in your index.html file, like this:

```
<script src="Measure.min.js"></script>
<script src="Markup.min.js"></script>
```