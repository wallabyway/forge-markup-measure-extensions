'use strict';

    /**
     * Curring object which generate a string that can be used
     * as a Dom element's 'style' value.
     *
     * @constructor
     */
    export function DomElementStyle() {

        this.reset();
    }

    /*
     * Constants
     */
    var BROWSER_PREFIXES = ['-ms-', '-webkit-', '-moz-', '-o-'];

    var proto = DomElementStyle.prototype;

    proto.reset = function() {

        this.attributes = {};
        this.dirty = false;
        this.styleString = '';

        return this;
    };

    /**
     *
     * @param {String} key
     * @param {*} value
     * @param {Object} [options]
     * @param {Boolean} [options.allBrowsers] - Whether to add browser prefix to key
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.Utils.DomeElemStyle}
     */
    proto.setAttribute = function(key, value, options) {

        this.attributes[key] = value;

        if (options && options.allBrowsers) {
            var that = this;
            BROWSER_PREFIXES.forEach(function(prefix){
                that.attributes[(prefix+key)] = value;
            });
        }
        this.dirty = true; // Could be optimized
        return this;
    };

    /**
     * Removes one or more attributes
     * @param {String|Array} key - Key or Keys to be removed
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.Utils.DomElemStyle} this
     */
    proto.removeAttribute = function(key) {

        if (!Array.isArray(key)) {
            key = [key];
        }

        var self = this;
        key.forEach(function(k) {
            if (k in self.attributes) {
                delete self.attributes[k];
                self.dirty = true;
            }
        });
        return this;
    };

    /**
     * Gets the String representation of this style object
     * @returns {string}
     */
    proto.getStyleString = function() {

        if (this.dirty) {
            this.styleString = generateStyle(this.attributes);
            this.dirty = false;
        }
        return this.styleString;
    };

    /**
     * Clones the current Object
     *
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.Utils.DomElemStyle}
     */
    proto.clone = function() {

        var clone = new DomElementStyle();
        var attributes = this.attributes;

        for (var key in attributes) {
            clone.setAttribute(key, attributes[key]);
        }
        return clone;
    };

    /**
     * Generates the style value string. Non mutable function.
     *
     * @param {Object} attributes
     * @private
     */
    function generateStyle(attributes) {

        var elements = [];
        for (var key in attributes) {
            var val = attributes[key];
            elements.push(key);
            elements.push(':');
            elements.push(val);
            elements.push('; ');
        }
        return elements.join('');
    }
