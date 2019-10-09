'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, composeRGBAString,
    setAttributeToMarkupSvg, updateMarkupPathSvgHitarea, addMarkupMetadata } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModePolyline } from './edit-modes/EditModePolyline'

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupPolyline(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color','stroke-opacity', 'fill-color', 'fill-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_POLYLINE;
        this.shape = createMarkupPathSvg('path');

        this.bindDomEvents();
    }

    MarkupPolyline.prototype = Object.create(Markup.prototype);
    MarkupPolyline.prototype.constructor = MarkupPolyline;

    var proto = MarkupPolyline.prototype;

    proto.getEditMode = function() {

        return new EditModePolyline(this.editor);
    };

    /**
     * Sets top-left and bottom-right values in client space coordinates (2d).
     *
     * @param position
     * @param size
     * @param locations
     * @param closed
     */
    proto.set = function(position, size, locations, closed) {

        this.rotation = 0; // Reset angle //
        this.locations = locations.concat();

        this.size.x = (size.x === 0) ? 1 : size.x;
        this.size.y = (size.y === 0) ? 1 : size.y;

        this.closed = closed;

        this.setSize(position, size.x, size.y);
        this.updateStyle();
    };


    /**
     * Applies data values into DOM element style/attribute(s)
     *
     */
    proto.updateStyle = function() {

        var style = this.style;
        var shape = this.shape;

        var strokeWidth = this.style['stroke-width'];
        var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
        var fillColor = this.closed ? composeRGBAString(style['fill-color'], style['fill-opacity']) : 'none';
        var transform = this.getTransform();

        setAttributeToMarkupSvg(shape, 'd',  this.getPath().join(' '));
        setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth);
        setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
        setAttributeToMarkupSvg(shape, 'fill', fillColor);
        setAttributeToMarkupSvg(shape, 'transform', transform);
        updateMarkupPathSvgHitarea(shape, this.editor);
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

        if (locationsCount === 0) {
            return ' ';
        }

        path.push('M');
        path.push(locations[0].x);
        path.push(locations[0].y);

        for (var i = 1; i < locationsCount; ++i) {

            var locationA = locations[i - 1];
            var locationB = locations[i];

            path.push('l');
            path.push(locationB.x - locationA.x);
            path.push(locationB.y - locationA.y);
        }

        this.closed && path.push('z');
        return path;
    };
