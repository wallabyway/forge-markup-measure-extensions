'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { composeRGBAString, setAttributeToMarkupSvg, addMarkupMetadata, radiansToDegrees,
    createMarkupTextSvg, setMarkupTextSvgTransform, updateMarkupTextSvgBackground,
    updateMarkupTextSvgClipper, updateMarkupTextSvgHitarea, createSvgElement } from './MarkupsCoreUtils'
import { cloneStyle, isStyleEqual, copyStyle } from './StyleUtils'
import { EditModeText } from './edit-modes/EditModeText'

    // LMV ViewerLMV-2170 [Markup] [PDF] Text markup missing/cutoff for normal sized text.
    // If the font size of an SVG text is too small, the text is not rendered independently of its final screen size.
    // To solve the issue we multiply font size by 100 and scale down the text in its transform.
    var FONT_SIZE_SCALE = 100;

    var STARTING_WIDTH_FACTOR = 6;

    /**
     * Text Markup.
     * @constructor
     */
    export function MarkupText(id, editor, size) {

        var styleAttributes = [
            'font-size',
            'stroke-color',
            'stroke-opacity',
            'fill-color',
            'fill-opacity',
            'font-family',
            'font-style',
            'font-weight'
        ];

        Markup.call(this, id, editor, styleAttributes);

        // Bind to this to pass globalManager
        this.createSvgElement = createSvgElement.bind(this);
        this.addMarkupMetadata = addMarkupMetadata.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_TEXT;
        this.shape = createMarkupTextSvg();
        this.constraintRotation = true;
        this.constraintHeight = true;
        this.constraintWidth = false;
        this.size.x = size.x;
        this.size.y = size.y;
        this.currentText = "";
        this.currentTextLines = [""];
        this.textDirty = true;
        this.textSize = {x: 0, y: 0};
        this.prevHighlight = false;
        this.isHelperTextActive = false;

        // Note: We could have this property be a style property.
        // However, there is no need for this property to be exposed to the user for alteration
        // This value is a percentage of the font size used to offset vertically 2 text lines
        // of the same paragraph.
        // Notice that this value is used by EditorTextInput.js
        this.lineHeight = 130;

        this.minWidth = this.getClientFontSize() * STARTING_WIDTH_FACTOR;

        this.bindDomEvents();
    }

    MarkupText.prototype = Object.create(Markup.prototype);
    MarkupText.prototype.constructor = MarkupText;

    var proto = MarkupText.prototype;

    proto.getEditMode = function() {

        return new EditModeText(this.editor);
    };

    /**
     *
     * @param {String} position
     * @param {String} size
     * @param {String} textString
     */
    proto.set = function(position, size, textString) {

        this.position.x = position.x;
        this.position.y = position.y;
        this.size.x = size.x;
        this.size.y = size.y;

        this.setText(textString);
    };

    proto.setSize = function(position, width, height) {

        this.position.x = position.x;
        this.position.y = position.y;
        this.size.x = width;
        this.size.y = height;

        var sizeUpdateRequired = true;

        if (this.isHelperTextActive) {
            this.updateTextBoxStyle();
        } else {
            this.updateStyle(sizeUpdateRequired);
        }
    };

    proto.setPosition = function(x, y) {

        this.position.x = x;
        this.position.y = y;

        if (this.isHelperTextActive) {
            this.updateTextBoxStyle();
        } else {
            this.updateStyle();
        }
    };

    proto.setStyle = function(style) {

        var stylesEqual = isStyleEqual(style, this.style);

        if (!stylesEqual) {
            copyStyle(style, this.style);
        }

        this.updateStyle(!stylesEqual);
    };

    /**
     *
     * @param {String} text
     */
    proto.setText = function(text) {

        this.currentText = text;
    };

    /**
     * Returns the raw string value
     * @returns {String}
     */
    proto.getText = function() {

        return this.currentText;
    };

    /**
     * Returns a shallow copy of the text lines used for rendering SVG text
     * @returns {Array.<String>}
     */
    proto.getTextLines = function() {

        return this.currentTextLines.concat();
    };

    proto.highlightChanged = function() {

        if (this.highlighted && this.highlighted !== this.prevHighlight) {
            var shape = this.shape;
            var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
            setAttributeToMarkupSvg(shape, 'fill', strokeColor);

            this.prevHighlight = true;
            return false;
        }

        return true;
    };

    proto.updateTextBoxStyle = function() {
        var editMode = this.editor.duringEditMode && this.editor.editMode;

        if (!editMode || editMode.type !== this.type) {
            editMode = this.getEditMode();
        }

        editMode.updateTextBoxStyle();
    };

    proto.setIsHelperTextActive = function(isActive) {
        this.isHelperTextActive = isActive;
    };

    /**
     * Applies data values into DOM element style/attribute(s)
     *
     */
    proto.updateStyle = function(sizeUpdateRequired) {

        if (this.highlightChanged()) {
            this.prevHighlight = false;
            var style = this.style;
            var shape = this.shape;
            var fontSize = this.style['font-size'];
            var fontFamily = this.style['font-family'];
            var fontWeight = this.style['font-weight'];
            var fontStyle = this.style['font-style'];
            var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
            var fillColor = composeRGBAString(style['fill-color'], style['fill-opacity']);

            // FONT_SIZE_SCALE is used to scale up fontSize, but it is only needed in cases where the font size is too small
            FONT_SIZE_SCALE = (fontSize > 1) ? 1 : 100;

            this.rebuildTextSvg(sizeUpdateRequired);

            setAttributeToMarkupSvg(shape, 'font-family', fontFamily);
            setAttributeToMarkupSvg(shape, 'font-size', fontSize * FONT_SIZE_SCALE);
            setAttributeToMarkupSvg(shape, 'fill', strokeColor);
            setAttributeToMarkupSvg(shape, 'font-weight', fontWeight);
            setAttributeToMarkupSvg(shape, 'font-style', fontStyle);

            var editor = this.editor;
            var transform = this.getTransform();
            var textTransform = this.getTextTransform();

            setMarkupTextSvgTransform(shape, transform, textTransform);
            updateMarkupTextSvgBackground(shape, this.size.x, this.size.y, fillColor);
            updateMarkupTextSvgClipper(shape, this.size.x, this.size.y);
            updateMarkupTextSvgHitarea(shape, this.size.x, this.size.y, editor);
        }
    };

    /**
     * Re-creates SVG tags that render SVG text.
     * Each line is placed around tspan tags which are vertically offset to each other.
     */
    proto.rebuildTextSvg = function(sizeUpdateRequired) {

        // TODO: Remove the need to get text values from an object in edit mode, should be a function.
        // editMode needs to be set to load markups in view mode
        var editMode = this.editor.duringEditMode && this.editor.editMode;

        if (!editMode || editMode.type !== this.type) {
            editMode = this.getEditMode();
            editMode.textInputHelper.textArea.value = this.currentText;
            editMode.textInputHelper.setStyle(this.style);
        }

        if (editMode.textInputHelper.textMarkup && editMode.textInputHelper.textMarkup !== this) {
            return;
        }

        var style = cloneStyle(editMode.textInputHelper.style);
        var text = editMode.textInputHelper.textArea.value;

        var textHelperValues = editMode.textInputHelper.getTextValuesForMarkup(this, sizeUpdateRequired);

        this.currentTextLines = textHelperValues.textValues.lines;

        if (textHelperValues.newPos) {
            var position = this.editor.positionFromClientToMarkups(textHelperValues.newPos.x, textHelperValues.newPos.y);
            var size = this.editor.sizeFromClientToMarkups(textHelperValues.width, textHelperValues.height);

            this.position.x = position.x;
            this.position.y = position.y;
            this.size.x = size.x;
            this.size.y = size.y;
        }

        if (editMode.selectedMarkup !== this && !editMode.textInputHelper.firstEdit) {
            editMode.textInputHelper.textArea.value = text;
            editMode.textInputHelper.setStyle(style);
        }

        var markup = this.createSvgElement('text');
        markup.setAttribute('id', 'markup');
        markup.setAttribute('alignment-baseline', 'middle');

        this.shape.childNodes[0].removeChild(this.shape.markup);
        this.shape.childNodes[0].appendChild(markup);
        this.shape.markup = markup;

        // For each line, create a tspan, add as child and offset it vertically.
        var yOffset = this.getLineHeight() * FONT_SIZE_SCALE * (this.lineHeight / 100);

        var padding = (this.getLineHeight() * FONT_SIZE_SCALE) / 2;
        var dx = padding;
        var dy = padding;

        this.currentTextLines.forEach(function(line){

            var tspan = this.createSvgElement('tspan');

            tspan.setAttribute('x', dx);
            tspan.setAttribute('y', dy);
            tspan.textContent = line;

            markup.appendChild(tspan);
            dy += yOffset;
        }.bind(this));
    };

    proto.setIsShapeVisible = function(isVisible) {

        this.shape.style.display = (isVisible) ? 'block' : 'none';
    };

    proto.setMetadata = function() {

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.position = [this.position.x, this.position.y].join(" ");
        metadata.size = [this.size.x, this.size.y].join(" ");
        metadata.text = String(this.currentText);

        return this.addMarkupMetadata(this.shape, metadata);
    };

    /**
     * Helper method that returns the font size in client space coords.
     * @returns {Number}
     */
    proto.getClientFontSize = function() {

        return this.editor.sizeFromMarkupsToClient(0, this.style['font-size']).y;
    };

    proto.getLineHeight = function() {

        return this.style['font-size'];
    };

    proto.getTransform = function() {

        var x = this.position.x - this.size.x * 0.5;
        var y = this.position.y + this.size.y * 0.5;

        return [
            'translate(', x, ',', y, ')',
            'rotate(', radiansToDegrees(-this.rotation), ')',
            'scale(1,-1)'
        ].join(' ');
    };

    proto.getTextTransform = function() {

        var lineHeight = this.getLineHeight();

        var x = this.position.x - this.size.x * 0.5;
        var y = this.position.y + this.size.y * 0.5 - lineHeight;

        return [
            'translate(', x, ',', y, ')',
            'rotate(', radiansToDegrees(-this.rotation), ')',
            'scale(' + (1/FONT_SIZE_SCALE) + ',' + (-1/FONT_SIZE_SCALE) + ')'
        ].join(' ');
    };

    proto.cloneShape = function(clone) {

        clone.shape = createMarkupTextSvg();
        clone.bindDomEvents();
    };

    proto.getBoundingRect = function() {
        var pos = this.getClientPosition();
        var size = this.getClientSize();
        return {
            x: pos.x - size.x / 2,
            y: pos.y - size.y / 2,
            width: size.x,
            height: size.y
        }
    };
