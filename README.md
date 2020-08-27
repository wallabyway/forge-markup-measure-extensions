## Building Measure/Markup extensions

This is a public 'mirror' version of forge viewer markup and measure extensions.  Use webpack to build these extensions locally, then modify as desired.

**Motivation:**
Forge customers can customize markup and measure tool

Here's a blog post on how to use the built-in features: https://forge.autodesk.com/blog/using-autodeskviewingmarkupscore-extension

![](https://flint-prodcms-forge.s3.amazonaws.com/prod/s3fs-public/2018-07/prev.gif)

Source: https://forge.autodesk.com/blog/viewing-large-ocrterrain-images-forge-viewer

But these APIs are limited.  Sometimes you have to hack the viewer3d.js file, in order to achieve the behavior you want.  For example, creating an SVG stamp tool (see examples below).  It's not really possible without overriding large amounts of code with prototypes.

Instead, what if you could modify the existing markup and measure extensions, without touching viewer3d.js ?  Well, here's how...

Use this mirror code, to build these extensions seperately.  Then modify the extensions code as you need, seperate from the viewer3d.js file.



#### Customization blog posts:

- to save/restore measurements to a database (save/restore): https://forge.autodesk.com/blog/area-planning-tool-forge-viewer-and-mysql
- create an SVG 'stamp' for markup tool: https://forge.autodesk.com/blog/fast-pdf-viewingmarkup-inside-forge-viewer

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

