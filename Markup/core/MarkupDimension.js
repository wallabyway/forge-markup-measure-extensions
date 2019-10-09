'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, createMarkupTextSvg, composeRGBAString, addMarkupMetadata,
    radiansToDegrees, degreesToRadians, measureTextLines, setMarkupTextSvgTransform,
    setAttributeToMarkupSvg, updateMarkupPathSvgHitarea, createSvgElement, checkLineSegment,
    updateMarkupTextSvgBackground, updateMarkupTextSvgClipper, updateMarkupTextSvgHitarea 
} from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModeDimension } from './edit-modes/EditModeDimension'

    var DIMENSION_MARKUP_HEIGHT = 10;
    var TEXT_OFFSET = 2;
    var DEFAULT_TEXT = 'Add Length';
    var BACKGROUND_COLOR = 'none';//'#ffffff';

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupDimension(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'font-size', 'font-family', 'font-style', 'font-weight'];
        Markup.call(this, id, editor, styleAttributes);

        this.type = MarkupTypes.MARKUP_TYPE_DIMENSION;
        this.constraintHeight = true;
        this.constraintWidth = true;

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);
        this.createSvgElement = createSvgElement.bind(this);
        this.checkLineSegment = checkLineSegment.bind(this);
        this.measureTextLines = measureTextLines.bind(this);

        
        this.firstAnchor = new THREE.Vector3();
        this.secondAnchor = new THREE.Vector3();
        this.shape = createMarkupPathSvg();
        this.text = createMarkupTextSvg();
        this.shape.appendChild(this.text);
        this.textSize = {x: 0, y: 0};
        this.initialText = DEFAULT_TEXT;
        this.currentText = ' ';

        if (!this.viewer.model.is2d()) {
            this.preventReposition = true;
            this.constraintRotation = true;
        }

        this.bindDomEvents();
    }

    MarkupDimension.prototype = Object.create(Markup.prototype);
    MarkupDimension.prototype.constructor = MarkupDimension;

    var proto = MarkupDimension.prototype;

    proto.getEditMode = function() {

        return new EditModeDimension(this.editor);
    };

    /**
     * Sets top-left and bottom-right values in client space coordinates (2d).
     * Notice that for the Dimension, the top left is the "secondAnchor" of the Dimension and
     * the bottom right is the "firstAnchor" of it.
     *
     * @param {Number} xO - secondAnchor
     * @param {Number} yO - secondAnchor
     * @param {Number} xF - firstAnchor
     * @param {Number} yF - firstAnchor
     */
    proto.set = function(xO, yO, xF, yF, text) {

        var vO = new THREE.Vector2(xO, yO);
        var vF = new THREE.Vector2(xF, yF);
        var vDir = vF.clone().sub(vO).normalize();

        this.size.x = vO.distanceTo(vF); // TODO: Clamp min length
        this.rotation = Math.acos(vDir.dot(new THREE.Vector2(1,0)));
        this.rotation = yF > yO ? (Math.PI*2)-this.rotation : this.rotation;

        var firstAnchor = this.firstAnchor;
        var secondAnchor = this.secondAnchor;

        firstAnchor.set(xF, yF, 0);
        secondAnchor.set(xO, yO, 0);

        this.position.x = secondAnchor.x + (firstAnchor.x - secondAnchor.x) * 0.5;
        this.position.y = secondAnchor.y + (firstAnchor.y - secondAnchor.y) * 0.5;

        this.currentText = text;
        this.updateStyle();
    };

    /**
     * Changes the rotation of the markup to the given angle.
     * This gets called by the Autodesk.Viewing.Extensions.Markups.Core.SetRotation edit action
     *
     * @param {Number} angle
     */
    proto.setRotation = function(angle) {

        if (radiansToDegrees(angle) === 90) {
            angle = degreesToRadians(-90);
        }

        this.rotation = angle;

        var xF = Math.cos(-angle);
        var yF = Math.sin(-angle);
        var vFDir = new THREE.Vector2(xF, yF); // already normalized
        vFDir.multiplyScalar(this.size.x*0.5);

        var vCenter = new THREE.Vector2(this.position.x, this.position.y);
        var vO = vCenter.clone().sub(vFDir);
        var vF = vCenter.clone().add(vFDir);

        this.firstAnchor.set(vF.x, vF.y, 0);
        this.secondAnchor.set(vO.x, vO.y, 0);

        this.updateStyle();
    };

    /**
     * Changes the position and size of the markup.
     * This gets called by the namespace.SetSize edit action
     * @param {{x: Number, y: Number}} position - Dimension's center
     * @param {Number} width - Dimension's length
     * @param {Number} height - We ignore this one because we use the Dimension's stroke width instead
     */
    proto.setSize = function(position, width, height) {

        var xF = Math.cos(-this.rotation);
        var yF = Math.sin(-this.rotation);
        var vFDir = new THREE.Vector2(xF, yF); // already normalized
        vFDir.multiplyScalar(width*0.5);

        var vCenter = new THREE.Vector2(position.x, position.y);
        var vO = vCenter.clone().sub(vFDir);
        var vF = vCenter.clone().add(vFDir);

        this.firstAnchor.set(vF.x, vF.y, 0);
        this.secondAnchor.set(vO.x, vO.y, 0);

        this.position.x = position.x;
        this.position.y = position.y;
        this.size.x = width;

        this.updateStyle();
    };

    /**
     * Helper method that returns the font size in client space coords.
     * @returns {Number}
     */
    proto.getClientFontSize = function() {

        return this.editor.sizeFromMarkupsToClient(0, this.style['font-size']).y;
    };

    proto.updateStyle = function() {

        var style = this.style;
        var shape = this.shape;
        var strokeWidth = style['stroke-width'];
        var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
        var transform = this.getTransform();

        this.rebuildTextSvg(this.currentText);

        setAttributeToMarkupSvg(shape, 'd', this.getPath().join(' '));
        setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth / 2);
        setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
        setAttributeToMarkupSvg(shape, 'fill', strokeColor);
        setAttributeToMarkupSvg(shape, 'transform', transform);
        updateMarkupPathSvgHitarea(shape, this.editor);
    };

    proto.rebuildTextSvg = function(value) {
        var style = this.style;
        var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
        var strokeWidth = style['stroke-width'];
        var backgroundColor = (value === ' ') ? 'none' : BACKGROUND_COLOR;

        var markup = this.createSvgElement('text');
        markup.setAttribute('id', 'markup');
        markup.setAttribute('alignment-baseline', 'middle');

        var text = this.text;
        var editor = this.editor;

        text.childNodes[0].removeChild(text.markup);
        text.childNodes[0].appendChild(markup);
        text.markup = markup;

        var tspan = this.createSvgElement('tspan');
        tspan.textContent = value;
        markup.appendChild(tspan);

        var lineSize = this.measureTextLines([value], style, editor)[0]; // Only one line for measurement
        var textSize = this.textSize = editor.sizeFromClientToMarkups(lineSize.width, lineSize.height);
        
        var edgeH = DIMENSION_MARKUP_HEIGHT * strokeWidth / 2;
        var textOffset = TEXT_OFFSET * strokeWidth / 2;
        var offset = (textSize.x + (2 * strokeWidth) >= this.size.x) ? textOffset + edgeH / 2 : textOffset; // If the line is too short for the given text, put it under.

        this.size.y = edgeH + textSize.y + offset;

        var textTransform = this.getTextTransform((4/5 * textSize.y) +  offset, true); // Text height is Always 4/5 of the entire label height.
        var backgroundTransform = this.getTextTransform(textSize.y + offset, false);

        setAttributeToMarkupSvg(text, 'font-family', style['font-family']);
        setAttributeToMarkupSvg(text, 'font-size', style['font-size']);
        setAttributeToMarkupSvg(text, 'font-weight', style['font-weight']);
        setAttributeToMarkupSvg(text, 'font-style', style['font-style']);
        setAttributeToMarkupSvg(text, 'text-rendering', 'auto');
        setAttributeToMarkupSvg(text, 'fill', strokeColor);
        setMarkupTextSvgTransform(text, backgroundTransform, textTransform); 
        updateMarkupTextSvgBackground(text, textSize.x, textSize.y, backgroundColor);
        updateMarkupTextSvgClipper(text, textSize.x, textSize.y);
        updateMarkupTextSvgHitarea(text, textSize.x, textSize.y, editor);
    };

    proto.shouldFlip = function(){
        return (this.firstAnchor.x < this.secondAnchor.x);
    };

    proto.getTextTransform = function(offset, inverse) {

        var flip = this.shouldFlip() ? -1 : 1;

        inverse = inverse ? -1 : 1;

        if (radiansToDegrees(this.rotation) === 90) {
            this.rotation = degreesToRadians(-90);
        }

        return [
            'translate(', this.position.x , ',', this.position.y, ')',
            'rotate(', radiansToDegrees(-this.rotation), ')',
            'translate(', -flip * this.textSize.x / 2, ',', -flip*offset, ')',
            'scale(' + flip + ',' + flip*inverse + ')'
        ].join(' ');
    };

    /**
     * Used by the EditFrame to move the markup in Client Space coordinates
     * @param {Number} x - New X location for the markup. Notice that markups are centered on this value.
     * @param {Number} y - New Y location for the markup. Notice that markups are centered on this value.
     */
    proto.setPosition = function (x, y) {

        var firstAnchor = this.firstAnchor;
        var secondAnchor = this.secondAnchor;

        var dx = firstAnchor.x - secondAnchor.x;
        var dy = firstAnchor.y - secondAnchor.y;

        var xo = x + dx * 0.5;
        var yo = y + dy * 0.5;

        firstAnchor.x = xo;
        firstAnchor.y = yo;

        secondAnchor.x = xo - dx;
        secondAnchor.y = yo - dy;

        this.position.x = secondAnchor.x + (firstAnchor.x - secondAnchor.x) * 0.5;
        this.position.y = secondAnchor.y + (firstAnchor.y - secondAnchor.y) * 0.5;

        this.updateStyle();
    };

    proto.generatePoint3d = function(idTarget) {

        var firstAnchor = this.editor.positionFromMarkupsToClient(this.firstAnchor.x, this.firstAnchor.y);
        var secondAnchor = this.editor.positionFromMarkupsToClient(this.secondAnchor.x, this.secondAnchor.y);

        var direction = firstAnchor.clone().sub(secondAnchor).normalize();

        var point2d = this.checkLineSegment(firstAnchor.x, firstAnchor.y, firstAnchor.x + direction.x * 200, firstAnchor.y + direction.y * 200, idTarget);
        var point3d = point2d && this.viewer.clientToWorld(point2d.x, point2d.y);

        return point3d && point3d.point;
    };

    proto.setMetadata = function() {

        this.text.setAttribute('pointer-events', 'none');

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.firstAnchor = [this.firstAnchor.x, this.firstAnchor.y].join(" ");
        metadata.secondAnchor = [this.secondAnchor.x, this.secondAnchor.y].join(" ");
        metadata.text = String(this.currentText);

        return this.addMarkupMetadata(this.shape, metadata);
    };


    /**
     * Returns the raw string value
     * @returns {String}
     */
    proto.getText = function() {

        // if the current text is 'Add Length', you want the textbox will be empty when the user open it.
        return (this.currentText === this.initialText) ? '' : this.currentText;
    };

    proto.getPath = function() {

        //   1_                            _4
        //   | |                          | |
        //   | |2                        3| |
        //  0|  --------------------------  |
        //   |  --------------------------  |
        //   | |7                       6 | |
        //   |_|          TEXT            |_|
        //   8                             5
        
        var strokeWidth = this.style['stroke-width'];
        var segmentLength = this.size.x - strokeWidth / 2; // segment length (p2 to p3 length)
        var edgeH = DIMENSION_MARKUP_HEIGHT * strokeWidth / 2; // Edge height (p1 to p8 length)

        return [
            'M', -segmentLength * 0.5           ,    0              ,   // 0
            'l', 0                              ,    edgeH / 2      ,   // 1
            'l', 0                              ,    -edgeH / 2     ,   // 2
            'l', segmentLength                  ,    0              ,   // 3
            'l', 0                              ,    edgeH / 2      ,   // 4
            'l', 0                              ,    -edgeH         ,   // 5
            'l', 0                              ,    edgeH / 2      ,   // 6
            'l', -segmentLength                 ,    0              ,   // 7
            'l', 0                              ,    -edgeH / 2     ,   // 8
            'z'
        ];
    };

    proto.cloneShape = function(clone) {
        
        clone.shape = createMarkupPathSvg();
        clone.text = createMarkupTextSvg();
        clone.shape.appendChild(clone.text);
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
