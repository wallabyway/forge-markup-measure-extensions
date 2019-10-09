'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, composeRGBAString, createRectanglePath,
    setAttributeToMarkupSvg, updateMarkupPathSvgHitarea, addMarkupMetadata } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModeRectangle } from './edit-modes/EditModeRectangle'

    /**
     * Rectangle markup.
     *
     * Implements a Rectangle {@link Autodesk.Viewing.Extensions.Markups.Core.Markup|Markup}.
     * Included in documentation as an example of how to create
     * a specific markup type. Developers are encourage to look into this class's source code and copy
     * as much code as they need. Find link to source code below.
     *
     * @tutorial feature_markup
     * @constructor
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     * @extends Autodesk.Viewing.Extensions.Markups.Core.Markup
     *
     * @param {number} id
     * @param {Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore} editor
     * @constructor
     */
    export function MarkupRectangle(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // Bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_RECTANGLE;
        this.shape = createMarkupPathSvg();

        this.bindDomEvents();
    }

    MarkupRectangle.prototype = Object.create(Markup.prototype);
    MarkupRectangle.prototype.constructor = MarkupRectangle;

    var proto = MarkupRectangle.prototype;

    proto.getEditMode = function() {

        return new EditModeRectangle(this.editor);
    };

    /**
     * Sets position and size in markup space coordinates
     * @param {Object} position
     * @param {Object} size
     */
    proto.set = function(position, size) {

        this.position.x = position.x;
        this.position.y = position.y;
        this.size.x = size.x;
        this.size.y = size.y;

        this.updateStyle();
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

        var strokeWidth = this.style['stroke-width'];

        var w = this.size.x - strokeWidth;
        var h = this.size.y - strokeWidth;
        var x =-w * 0.5;
        var y =-h * 0.5;

        var path = [];
        createRectanglePath(x, y, w, h, false, path);

        return path;
    };
