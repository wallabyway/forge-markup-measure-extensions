var webpack = require('webpack');
var fs = require('fs');
var path = require('path');

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





    var outputPath =  path.resolve(__dirname, "./build");

    function getExternalExtensions() {
        return [
            // First is the path to extension's entry point,
            // Second (and all others) are the extension IDs.
            {
                src: './Measure/Measure',
                ids: ['Autodesk.Measure'],
            },
            {
                src: './Markup/Markup',
                ids: [
                    'Autodesk.Viewing.MarkupsCore', 
                    'Autodesk.Viewing.MarkupsGui'
                ],
            },

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
 
