## Building Measure/Markup extensions

This is a public 'mirror' version of forge viewer markup and measure extensions.  Use webpack to build these extensions locally, then modify as desired.

**Motivation:**
Forge customers can customize markup and measure tools, but it's limited without changing the viewer3d.js file.  Instead, they can recreate the markup and measure tools, by using this mirror code and rebuilding their own custom markup and measure tools.


This is what the current tools (markup and measure) can do:

![](https://flint-prodcms-forge.s3.amazonaws.com/prod/s3fs-public/2018-07/prev.gif)

Source: https://forge.autodesk.com/blog/viewing-large-ocrterrain-images-forge-viewer


#### Customization blog posts:

- for measure tool (save/restore): https://forge.autodesk.com/blog/area-planning-tool-forge-viewer-and-mysql
- for markup tool ("stamp it"): https://forge.autodesk.com/blog/fast-pdf-viewingmarkup-inside-forge-viewer
- for 3d push-pins (webgl shader): https://forge.autodesk.com/blog/3d-markup-icons-and-info-card

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

## Alternatives

Edit2D extension: https://forge.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-use/

