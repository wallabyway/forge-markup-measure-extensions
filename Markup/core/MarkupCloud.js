'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, composeRGBAString, setAttributeToMarkupSvg,
    updateMarkupPathSvgHitarea, addMarkupMetadata, createEllipsePath } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModeCloud } from './edit-modes/EditModeCloud'

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupCloud(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-linejoin', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_CLOUD;
        this.shape = createMarkupPathSvg();

        this.bindDomEvents();
    }

    MarkupCloud.prototype = Object.create(Markup.prototype);
    MarkupCloud.prototype.constructor = MarkupCloud;

    var proto = MarkupCloud.prototype;

    proto.getEditMode = function() {

        return new EditModeCloud(this.editor);
    };

    /**
     * Sets position and size in markup space coordinates.
     * @param {Object} position
     * @param {Object} size
     */
    proto.set = function(position, size) {

        this.setSize(position, size.x, size.y);
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
        var fillColor = composeRGBAString(style['fill-color'], style['fill-opacity']);
        var transform = this.getTransform();

        setAttributeToMarkupSvg(shape, 'd', path);
        setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth);
        setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
        setAttributeToMarkupSvg(shape, 'fill', fillColor);
        setAttributeToMarkupSvg(shape, 'transform', transform);
        updateMarkupPathSvgHitarea(shape, this.editor);
    };

    proto.setMetadata = function() {

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.position = [this.position.x, this.position.y].join(" ");
        metadata.size = [this.size.x, this.size.y].join(" ");
        metadata.rotation = String(this.rotation);

        return this.addMarkupMetadata(this.shape, metadata);
    };

    /**
     * Helper function that creates intermediate points given the
     * current position and size.
     * @returns {Array}
     */
    proto.getPath = function() {

        var position = this.position;
        var size = this.size;
        var strokeWidth = this.style['stroke-width'];
        var radius = strokeWidth * 2;

        function createArcTo(x, y, xRadius, yRadius, path) {

            path.push('a');
            path.push(xRadius);
            path.push(yRadius);
            path.push(0);
            path.push(1);
            path.push(1);
            path.push(x);
            path.push(y);

            return path;
        }

        function createCorner(corner, xRadius, yRadius, strokeWidth, path) {

            switch(corner) {

                case 'LT':
                    return createArcTo( xRadius,-yRadius, xRadius, yRadius, path);
                    break;

                case 'RT':
                    return createArcTo( xRadius, yRadius, xRadius, yRadius, path);
                    break;

                case 'RB':
                    return createArcTo(-xRadius, yRadius, xRadius, yRadius, path);
                    break;

                case 'LB':
                    return createArcTo(-xRadius,-yRadius, xRadius, yRadius, path);
                    break;
            }
        }

        function getSideParameters(x1, x2, radius, strokeWidth) {

            var diameter = radius * 2;
            var length = Math.abs(x2 - x1 - strokeWidth);
            var count = Math.round(length / diameter);

            diameter += (length - diameter * count) / count;
            radius = diameter * 0.5;

            var xValueInset = diameter * 0.05;
            var yValueOffset = radius * 3.5 / 3.0;

            return {
                count: count,
                radius: radius,
                diameter: diameter,
                p1: {x: xValueInset, y: -yValueOffset },
                p2: {x: diameter - xValueInset, y: -yValueOffset},
                p3: {x: diameter, y: 0}
            };
        }

        function createTSide(hSidesParameters, path){

            var sp = hSidesParameters;
            for(var i = 0; i < sp.count; ++i) {

                path.push('c');
                path.push(sp.p1.x);
                path.push(sp.p1.y);
                path.push(sp.p2.x);
                path.push(sp.p2.y);
                path.push(sp.p3.x);
                path.push(sp.p3.y);
            }

            return path;
        }

        function createRSide(vSidesParameters, path){

            var sp = vSidesParameters;
            for(var i = 0; i < sp.count; ++i) {
                path.push('c');
                path.push(-sp.p1.y);
                path.push(sp.p1.x);
                path.push(-sp.p2.y);
                path.push(sp.p2.x);
                path.push(-sp.p3.y);
                path.push(sp.p3.x);
            }

            return path;
        }

        function createBSide(hSidesParameters, path){

            var sp = hSidesParameters;
            for(var i = 0; i < sp.count; ++i) {
                path.push('c');
                path.push(-sp.p1.x);
                path.push(-sp.p1.y);
                path.push(-sp.p2.x);
                path.push(-sp.p2.y);
                path.push(-sp.p3.x);
                path.push(-sp.p3.y);
            }

            return path;
        }

        function createLSide(vSidesParameters, path){

            var sp = vSidesParameters;
            for(var i = 0; i < sp.count; ++i) {
                path.push('c');
                path.push(sp.p1.y);
                path.push(-sp.p1.x);
                path.push(sp.p2.y);
                path.push(-sp.p2.x);
                path.push(sp.p3.y);
                path.push(-sp.p3.x);
            }

            return path;
        }

        var l = position.x;
        var t = position.y;
        var r = position.x + size.x;
        var b = position.y + size.y;

        var minSize = radius * 5;
        var path = [];

        if (size.x < minSize || size.y < minSize) {

            var w = size.x - strokeWidth;
            var h = size.y - strokeWidth;
            var x = -w * 0.5;
            var y = 0;

            createEllipsePath(x, y, w, h, false, path);
        } else {

            var hSidesParameters = getSideParameters(l, r, radius, strokeWidth);
            var vSidesParameters = getSideParameters(t, b, radius, strokeWidth);

            var cornerSizeX = hSidesParameters.diameter;
            var cornerSizeY = vSidesParameters.diameter;
            var cornerRadiusX = hSidesParameters.radius;
            var cornerRadiusY = vSidesParameters.radius;

            hSidesParameters = getSideParameters(l + cornerSizeX, r - cornerSizeX, radius, strokeWidth);
            vSidesParameters = getSideParameters(t + cornerSizeY, b - cornerSizeY, radius, strokeWidth);

            var halfStrokeWidth = strokeWidth * 0.5;
            var x =-size.x * 0.5 + halfStrokeWidth + cornerRadiusX;
            var y =-size.y * 0.5 + halfStrokeWidth + cornerRadiusY * 2;

            path.push('M');
            path.push(x);
            path.push(y);

            createCorner('LT', cornerRadiusX, cornerRadiusY, strokeWidth, path);
            createTSide(hSidesParameters, path);
            createCorner('RT', cornerRadiusX, cornerRadiusY, strokeWidth, path);
            createRSide(vSidesParameters, path);
            createCorner('RB', cornerRadiusX, cornerRadiusY, strokeWidth, path);
            createBSide(hSidesParameters, path);
            createCorner('LB', cornerRadiusX, cornerRadiusY, strokeWidth, path);
            createLSide(vSidesParameters, path);
        }

        path.push('z');
        return path;
    };
