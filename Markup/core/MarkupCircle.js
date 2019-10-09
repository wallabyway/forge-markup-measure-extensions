'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, composeRGBAString, setAttributeToMarkupSvg, 
        updateMarkupPathSvgHitarea, addMarkupMetadata, createEllipsePath } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModeCircle } from './edit-modes/EditModeCircle'

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupCircle(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_CIRCLE;
        this.shape = createMarkupPathSvg();

        this.bindDomEvents();
    }

    MarkupCircle.prototype = Object.create(Markup.prototype);
    MarkupCircle.prototype.constructor = MarkupCircle;

    var proto = MarkupCircle.prototype;

    proto.getEditMode = function() {

        return new EditModeCircle(this.editor);
    };

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

    proto.getPath = function() {

        var size = this.size;
        if (size.x === 1 || size.y === 1) {
            return [''];
        }

        var strokeWidth = this.style['stroke-width'];

        var ellipseW = size.x - strokeWidth;
        var ellipseH = size.y - strokeWidth;

        var ellipseX = -0.5*ellipseW;
        var ellipseY = 0;

        var path = [];
        createEllipsePath(ellipseX, ellipseY, ellipseW, ellipseH, false, path);

        return path;
    };
