'use strict';

import { Markup } from './Markup'
import { createMarkupPathSvg, setAttributeToMarkupSvg, updateMarkupPathSvgHitarea,
    composeRGBAString, addMarkupMetadata } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'

    /**
     * Base class for Pen Markup rendering (currently freehand and highlighter)
     *
     * Derived classes must implement getEditMode()
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupPen(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color','stroke-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.shape = createMarkupPathSvg();

        this.bindDomEvents();
    }

    MarkupPen.prototype = Object.create(Markup.prototype);
    MarkupPen.prototype.constructor = MarkupPen;

    var proto = MarkupPen.prototype;

    /**
     * Sets top-left and bottom-right values in client space coordinates (2d).
     *
     * @param position
     * @param size
     * @param locations
     */
    proto.set = function(position, size, locations, isAbsoluteCoords) {

        this.rotation = 0; // Reset angle //
        this.isAbsoluteCoords = isAbsoluteCoords;
        if (this.isAbsoluteCoords) {
            this.updatePath(locations);
        } else {
            this.locations = locations.slice(0);

            this.size.x = (size.x === 0) ? 1 : size.x;
            this.size.y = (size.y === 0) ? 1 : size.y;

            this.setSize(position, size.x, size.y);
            this.updateStyle();
        }
    };

    proto.setPosition = function(x,y) {

        this.position.x = x;
        this.position.y = y;

        var shape = this.shape;
        var transform = this.getTransform();

        setAttributeToMarkupSvg(shape, 'transform', transform);
        updateMarkupPathSvgHitarea(shape, this.editor);
    };

    /**
     * Applies data values into DOM element style/attribute(s)
     *
     */
    proto.updateStyle = function() {

        var style = this.style;
        var shape = this.shape;
        var path = this.getPath().join(' ');

        var strokeWidth = this.style['stroke-width'];
        var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
        var fillColor = 'none';

        setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth);
        setAttributeToMarkupSvg(shape, 'stroke-linejoin', 'round');
        setAttributeToMarkupSvg(shape, 'stroke-linecap', 'round');
        setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
        setAttributeToMarkupSvg(shape, 'fill', fillColor);

        this.updatePath(path);
        updateMarkupPathSvgHitarea(shape, this.editor);
    };

    proto.updatePath = function(path) {
        var shape = this.shape;
        var transform = this.isAbsoluteCoords ? 'scale(1)' : this.getTransform();

        setAttributeToMarkupSvg(shape, 'transform', transform);
        setAttributeToMarkupSvg(shape, 'd', path);
    };

    /**
     * Changes the position and size of the markup.
     * This gets called by the Autodesk.Viewing.Extensions.Markups.Core.SetSize edit action
     * @param {{x: Number, y: Number}} position
     * @param {Number} width
     * @param {Number} height
     */
    proto.setSize = function (position, width, height) {

        width = (width === 0 ? 1 : width);
        height = (height === 0 ? 1 : height);

        var locations = this.locations;
        var locationsCount = locations.length;

        var scaleX = width / this.size.x;
        var scaleY = height / this.size.y;

        for(var i = 0; i < locationsCount; ++i) {

            var point = locations[i];

            point.x *= scaleX;
            point.y *= scaleY;
        }

        this.position.x = position.x;
        this.position.y = position.y;

        this.size.x = width;
        this.size.y = height;

        this.updateStyle();
    };

    proto.setMetadata = function() {

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.position = [this.position.x, this.position.y].join(" ");
        metadata.size = [this.size.x, this.size.y].join(" ");
        metadata.rotation = String(this.rotation);
        metadata.locations = this.locations.map(function(point){
            return [point.x, point.y].join(" ");
        }).join(" ");

        return this.addMarkupMetadata(this.shape, metadata);
    };

    proto.getPath = function() {

        var path = [];
        var locations = this.locations;
        var locationsCount = locations.length;

        if (locationsCount > 1) {

            path.push('M');
            path.push(+(locations[0].x).toFixed(6));
            path.push(+(locations[0].y).toFixed(6));

            for (var i = 1; i < locationsCount; ++i) {

                var locationA = locations[i - 1];
                var locationB = locations[i];

                path.push('l');
                path.push(+(locationB.x - locationA.x).toFixed(6));
                path.push(+(locationB.y - locationA.y).toFixed(6));
            }
        }

        return path;
    };

