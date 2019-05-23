var webpack = require('webpack');
var fs = require('fs');
var path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MergeJsonWebpackPlugin = require("merge-jsons-webpack-plugin");

function NullPlugin() {
    this.apply = function(){};
}

// Give process a more descriptive name than just "npm"
process.title = 'lmv-webpack';

/**
 * Exports a function that returns an array of webpack configurations to run in parallel.
 * 
 * @param {object} env - Object containing command-line supplied variables 
 */
module.exports = function(env) {

    const PROD_BUILD = env.BUILD_PROD;

    // Defaults for local developer builds
    var build_version = env.BUILD_VERSION;
    var build_type = env.BUILD_TYPE || 'local';

    /**
     * 
     * @param {boolean} [extractCss=false] - Whether a CSS file will get generated (true) or not (false) 
     */
    function getModuleConfig(extractCss) {
        var moduleConfig = {
            rules: [
                {
                    test: /\.js$/,
                    include: [
                        path.resolve(__dirname, "../extensions"),
                    ],
                    exclude: [/\.min.js$/], //the min.js is for zlib pre-built modules
                    use: {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: '.babel',
                            presets: ['@babel/preset-env'],
                            compact: false,
                            retainLines: true
                        }
                    }
                },
                {
                    test: /\.svg$/,
                    loader: 'svg-url-loader'
                }
            ],
            noParse: [
                /\.min.js$/
            ]
        };

        if (extractCss) {
            // Generates a CSS file that needs to be included by the developer.
            moduleConfig.rules.push({
                test: /\.css$/,
                use: [ 
                    { loader: MiniCssExtractPlugin.loader },
                    { loader: "css-loader" },
                ]
            });
        } else {
            // CSS styles will be included into the HTML by inserting <style> tags
            moduleConfig.rules.push({
                test: /\.css$/,
                use: [
                    { loader: "style-loader" },
                    { loader: "css-loader" },
                ]
            });
        }

        return moduleConfig;
    }

    function getBannerPlugin() {
        return;
    }
    
    function getDefinePlugin(wantGui, buildType) {  
        
        let workerFile = PROD_BUILD ? 'lmvworker.min.js' : 'lmvworker.js';
        
        var patterns = {
            BUILD_FLAG__WANT_GUI: wantGui,
            BUILD_FLAG__BUILD_VERSION: JSON.stringify(build_version),
            BUILD_FLAG__BUILD_TYPE: JSON.stringify(buildType),
            BUILD_FLAG__LMV_WORKER_FILE: JSON.stringify(workerFile),
        };

        // Extensions...
        // Generates code chunk like this:
        //   ``` 
        //      register( EXTENSION_ID, EXTENSION_BUILD_OUTPUT_PATH.js );
        //   ```
        // See externalExtensions.js for more info.
        var extensions = getExternalExtensions();
        var replacement = '';
        extensions.forEach((ee)=>{
            
            // Add extension
            let key = getExtensionEntryKey(ee);
            let ext = PROD_BUILD ? 'min.js' : 'js';
            let file = `extensions/${key}/${key}.${ext}`;
            
            ee.ids.forEach((id)=>{

                let code = `register('${id}', '${file}');\n`;
                replacement += code;

            });
        });
        patterns.BUILD_FLAG__REGISTER_EXTERNAL_EXTENSIONS = replacement;

        return new webpack.DefinePlugin(patterns);
    }

    function getAllStringsJsonPlugin() {
        var folderLocales = [
            'en', 'cs', 'de', 'es', 'fr', 
            'it', 'ja', 'ko', 'pl', 'pt-BR', 
            'ru', 'tr', 'zh-HANS', 'zh-HANT', 
            'nl', 'sv', 'da'
        ];
        var patterns = folderLocales.map((locStr)=>{
            return {
                "pattern": "./res/locales/" + locStr + "/*.json ",
                "fileName": "./res/locales/" + locStr + "/allstrings.json" 
            }
        });
        return new MergeJsonWebpackPlugin({
            "output": { 
                "groupBy": patterns
            },
            "globOptions": {
                "nosort": true
            }
        });
    }


    var outputPath =  path.resolve(__dirname, "./build");

    function getExternalExtensions() {
        return [
            // First is the path to extension's entry point,
            // Second (and all others) are the extension IDs.
            {
                src: './Measure/Measure',
                ids: ['Autodesk.Measure'],
            },
/*            {
                src: './Markup/Markup.js',
                ids: [
                    'Autodesk.Viewing.MarkupsCore', 
                    'Autodesk.Viewing.MarkupsGui'
                ],
            },
*/
        ];
    }

    function getExtensionEntryKey(ee) {
        // Given ee.src == './extensions/Something/file.js'
        // then key == 'Something'
        let key = ee.src.split('/')[2];
        return key;
    }

    function getExtensionEntries() {

        var entries = {};
        var extensions = getExternalExtensions();
        extensions.forEach((ee)=>{
            let key = getExtensionEntryKey(ee);
            entries[key] = ee.src;
        });
        return entries;
    }

    //Can be run to produces minified or non-minified assets
    var extensionsWebConfig = {
        entry: getExtensionEntries(),
        output: {
            path: outputPath + '/extensions/',
            filename: PROD_BUILD ? '[name]/[name].min.js' : '[name]/[name].js',
            library: 'Autodesk.Extensions.[name]',
            libraryTarget: 'assign'
        },
        module: getModuleConfig(false),
        resolveLoader: { modules: [ 'node_modules', 'deployment/node_modules', 'deployment/webpack' ] },
        resolve: {
            alias: {
                'opentype.js$': path.resolve(__dirname, '../node_modules/opentype.js/dist/opentype.js'),
            }
        },
        plugins: [
        ],
    };


    // tasks
    var nameToTask = {
        "lmv-extensions": extensionsWebConfig,
    };

    var exportTasks = [];
    if (env.BUILD_TASK === 'lmv-all') {
        for (var taskId in nameToTask) {
            if (nameToTask.hasOwnProperty(taskId))
            exportTasks.push(nameToTask[taskId]);
        }
    } else {
        var task = nameToTask[env.BUILD_TASK];
        if (!task)
            throw new Error(`Invalid env.BUILD_TASK value: (${env.BUILD_TASK})`);
            exportTasks = [task];
    }
    exportTasks.forEach((task)=>{
        let isProd = PROD_BUILD && (task.target !== 'node');
        task.mode = isProd ? 'production' : 'development';
        task.devtool = isProd ? 'source-map' : false;
    })

    return exportTasks;

} // module.exports
 
