
/**
 * 
 * @param {*} attributes 
 * @param {*} editor 
 */
export var createStyle = function(attributes, editor) {

    var style = {};

    for(var i = 0; i < attributes.length; ++i) {

        style[attributes[i]] = null;
    }

    var defaults = getStyleDefaultValues(style, editor);

    for(var i = 0; i < attributes.length; ++i) {

        var attribute = attributes[i];
        style[attribute] = defaults[attribute].values[defaults[attribute].default].value;
    }

    return style;
};

/**
 *
 * @param source
 * @param destination
 * @returns {*}
 */
export var copyStyle = function(source, destination) {

    for(var attribute in destination) {
        if (source.hasOwnProperty(attribute)) {
            destination[attribute] = source[attribute];
        }
    }

    return destination;
};

/**
 *
 * @param source
 * @param destination
 * @returns {*}
 */
export var isStyleEqual = function(source, destination) {

    for(var attribute in destination) {
        if (source.hasOwnProperty(attribute) && source[attribute] !== destination[attribute]) {
            return false;
        }
    }

    return true;
};

/**
 *
 * @param source
 * @returns {{}}
 */
export var cloneStyle = function(source) {

    var clone = {};

    for(var attribute in source) {
        clone[attribute] = source[attribute];
    }

    return clone;
};

/**
 *
 * @param style
 * @param editor
 * @returns {{}}
 */
export var getStyleDefaultValues = function(style, editor) {

    function getWidths(normalWidth) {

        return {
            values: [
                {name:'Thin', value: normalWidth / 3},
                {name:'Normal', value: normalWidth},
                {name:'Thick', value: normalWidth * 3},
                {name:'Very Thick', value: normalWidth * 9}],
            default: 1
        };
    }

    function getLineJoins() {

        return {
            values: [
                {name:'Miter', value: 'miter'},
                {name:'Round', value: 'round'},
                {name:'Bevel', value: 'bevel'}],
            default: 0
        };
    }

    function getFontSizes(normalWidth) {

        return {
            values: [
                {name:'Thin', value: normalWidth / 2},
                {name:'Normal', value: normalWidth},
                {name:'Thick', value: normalWidth * 4}],
            default: 1
        };
    }

    function getColors() {

        return {
            values: [
                {name:'red', value: '#ff0000'},
                {name:'green', value: '#00ff00'},
                {name:'blue', value: '#0000ff'},
                {name:'white', value: '#ffffff'},
                {name:'black', value: '#000000'},
                {name:'yellow', value: '#ffff00'}],
            default: 0
        };
    }

    function getOpacities(defaultTransparent) {

        return {
            values: [
                {name:'100%', value: 1.00},
                {name:'75%', value:  0.75},
                {name:'50%', value: 0.50},
                {name:'25%', value: 0.25},
                {name:'0%', value: 0.00}],
            default: (defaultTransparent ? 4 : 0)
        };
    }

    function getFontFamilies() {

        // TODO: Localize?
        // TODO: Validate fonts with design
        // Source: http://www.webdesigndev.com/web-development/16-gorgeous-web-safe-fonts-to-use-with-css
        return {
            values:[
                {name:'Arial', value: 'Arial'},
                {name:'Arial Black', value: 'Arial Black'},
                {name:'Arial Narrow', value: 'Arial Narrow'},
                {name:'Century Gothic', value: 'Century Gothic'},
                {name:'Courier New', value: 'Courier New'},
                {name:'Georgia', value: 'Georgia'},
                {name:'Impact', value: 'Impact'},
                {name:'Lucida Console', value: 'Lucida Console'},
                {name:'Tahoma', value: 'Tahoma'},
                {name:'Verdana', value: 'Verdana'}
            ],
            default: 0
        };
    }

    function getFontStyles() {
        return {
            values:[
                {name:'Normal', value: 'normal'},
                {name:'Italic', value: 'italic'}],
            default: 0
        };
    }

    function getFontWeights() {
        return {
            values:[
                {name:'Normal', value: 'normal'},
                {name:'Bold', value: 'bold'}],
            default: 0};
    }

    var values = cloneStyle(style);
    var normaStrokeWidth = editor.getStrokeWidth();
    var normaFontWidth = editor.getFontWidth();

    for(var attribute in values) {

        switch(attribute) {
            case 'stroke-width':
                values[attribute] = getWidths(normaStrokeWidth);
                break;

            case 'stroke-linejoin':
                values[attribute] = getLineJoins();
                break;

            case 'font-size':
                values[attribute] = getFontSizes(normaFontWidth);
                break;

            case 'font-family':
                values[attribute] = getFontFamilies();
                break;

            case 'font-style':
                values[attribute] = getFontStyles();
                break;

            case 'font-weight':
                values[attribute] = getFontWeights();
                break;

            case 'stroke-color':
            case 'fill-color':
                values[attribute] = getColors();
                break;

            case 'stroke-opacity':
                var defaultTransparent = false;
                values[attribute] = getOpacities(defaultTransparent);
                break;

            case 'fill-opacity':
                var defaultTransparent = true;
                values[attribute] = getOpacities(defaultTransparent);
                break;

            default:
                break;
        }
    }

    return values;
};
