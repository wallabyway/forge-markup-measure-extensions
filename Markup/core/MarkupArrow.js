'use strict';

import { Markup } from './Markup'
import * as MarkupTypes from './MarkupTypes'
import { createMarkupPathSvg, composeRGBAString, setAttributeToMarkupSvg,
    updateMarkupPathSvgHitarea, checkLineSegment, addMarkupMetadata } from './MarkupsCoreUtils'
import { cloneStyle } from './StyleUtils'
import { EditModeArrow } from './edit-modes/EditModeArrow'

    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    export function MarkupArrow(id, editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity'];
        Markup.call(this, id, editor, styleAttributes);

        // bind to this to pass this.globalManager
        this.addMarkupMetadata = addMarkupMetadata.bind(this);
        this.checkLineSegment = checkLineSegment.bind(this);

        this.type = MarkupTypes.MARKUP_TYPE_ARROW;
        this.constraintHeight = true;

        // Create head and tail.
        this.head = new THREE.Vector3();
        this.tail = new THREE.Vector3();
        this.size.y = this.style['stroke-width'] * 3;
        this.shape = createMarkupPathSvg();

        this.bindDomEvents();
    }

    MarkupArrow.prototype = Object.create(Markup.prototype);
    MarkupArrow.prototype.constructor = MarkupArrow;

    var proto = MarkupArrow.prototype;

    proto.getEditMode = function() {

        return new EditModeArrow(this.editor);
    };

    /**
     * Sets top-left and bottom-right values in client space coordinates (2d).
     * Notice that for the arrow, the top left is the "tail" of the arrow and
     * the bottom right is the "head" of it.
     *
     * @param {Number} xO - tail
     * @param {Number} yO - tail
     * @param {Number} xF - head
     * @param {Number} yF - head
     */
    proto.set = function(xO, yO, xF, yF) {

        var vO = new THREE.Vector2(xO, yO);
        var vF = new THREE.Vector2(xF, yF);
        var vDir = vF.clone().sub(vO).normalize();

        this.size.x = vO.distanceTo(vF); // TODO: Clamp min length
        this.rotation = Math.acos(vDir.dot(new THREE.Vector2(1,0)));
        this.rotation = yF > yO ? (Math.PI*2)-this.rotation : this.rotation;

        var head = this.head;
        var tail = this.tail;

        head.set(xF, yF, 0);
        tail.set(xO, yO, 0);

        this.position.x = tail.x + (head.x - tail.x) * 0.5;
        this.position.y = tail.y + (head.y - tail.y) * 0.5;

        this.updateStyle();
    };

    /**
     * Changes the rotation of the markup to the given angle.
     * This gets called by the Autodesk.Viewing.Extensions.Markups.Core.SetRotation edit action
     *
     * @param {Number} angle
     */
    proto.setRotation = function(angle) {

        this.rotation = angle;

        var xF = Math.cos(-angle);
        var yF = Math.sin(-angle);
        var vFDir = new THREE.Vector2(xF, yF); // already normalized
        vFDir.multiplyScalar(this.size.x*0.5);

        var vCenter = new THREE.Vector2(this.position.x, this.position.y);
        var vO = vCenter.clone().sub(vFDir);
        var vF = vCenter.clone().add(vFDir);

        this.head.set(vF.x, vF.y, 0);
        this.tail.set(vO.x, vO.y, 0);

        this.updateStyle();
    };

    /**
     * Changes the position and size of the markup.
     * This gets called by the namespace.SetSize edit action
     * @param {{x: Number, y: Number}} position - arrow's center
     * @param {Number} width - Arrow's length
     * @param {Number} height - We ignore this one because we use the arrow's stroke width instead
     */
    proto.setSize = function(position, width, height) {

        var xF = Math.cos(-this.rotation);
        var yF = Math.sin(-this.rotation);
        var vFDir = new THREE.Vector2(xF, yF); // already normalized
        vFDir.multiplyScalar(width*0.5);

        var vCenter = new THREE.Vector2(position.x, position.y);
        var vO = vCenter.clone().sub(vFDir);
        var vF = vCenter.clone().add(vFDir);

        this.head.set(vF.x, vF.y, 0);
        this.tail.set(vO.x, vO.y, 0);

        this.position.x = position.x;
        this.position.y = position.y;
        this.size.x = width;

        this.updateStyle();
    };

    proto.updateStyle = function() {

        var style = this.style;
        var shape = this.shape;
        var strokeWidth = style['stroke-width'];
        var strokeColor = this.highlighted ? this.highlightColor : composeRGBAString(style['stroke-color'], style['stroke-opacity']);
        var transform = this.getTransform();

        this.size.y = strokeWidth * 3;
        this.style['fill-color'] = style['stroke-color'];
        this.style['fill-opacity'] = style['stroke-opacity'];

        setAttributeToMarkupSvg(shape, 'd', this.getPath().join(' '));
        setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth);
        setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
        setAttributeToMarkupSvg(shape, 'fill', strokeColor);
        setAttributeToMarkupSvg(shape, 'transform', transform);
        updateMarkupPathSvgHitarea(shape, this.editor);
    };

    /**
     * Used by the EditFrame to move the markup in Client Space coordinates
     * @param {Number} x - New X location for the markup. Notice that markups are centered on this value.
     * @param {Number} y - New Y location for the markup. Notice that markups are centered on this value.
     */
    proto.setPosition = function (x, y) {

        var head = this.head;
        var tail = this.tail;

        var dx = head.x - tail.x;
        var dy = head.y - tail.y;

        var xo = x + dx * 0.5;
        var yo = y + dy * 0.5;

        head.x = xo;
        head.y = yo;

        tail.x = xo - dx;
        tail.y = yo - dy;

        this.position.x = tail.x + (head.x - tail.x) * 0.5;
        this.position.y = tail.y + (head.y - tail.y) * 0.5;

        this.updateStyle();
    };

    proto.generatePoint3d = function(idTarget) {

        var head = this.editor.positionFromMarkupsToClient(this.head.x, this.head.y);
        var tail = this.editor.positionFromMarkupsToClient(this.tail.x, this.tail.y);

        var direction = head.clone().sub(tail).normalize();

        var point2d = this.checkLineSegment(head.x, head.y, head.x + direction.x * 200, head.y + direction.y * 200, idTarget);
        var point3d = point2d && this.viewer.clientToWorld(point2d.x, point2d.y);

        return point3d && point3d.point;
    };

    proto.setMetadata = function() {

        var metadata = cloneStyle(this.style);

        metadata.type = this.type;
        metadata.head = [this.head.x, this.head.y].join(" ");
        metadata.tail = [this.tail.x, this.tail.y].join(" ");
        metadata.rotation = String(this.rotation);

        return this.addMarkupMetadata(this.shape, metadata);
    };

    proto.getPath = function() {

        // To build the arrow we need 7 points in total
        // The 'default' arrow built here has the following characteristics:
        //
        // 1. It is built horizontally facing right
        // 2. It's bounding rectangle has length: this.size.x
        // 3. It's bounding rectangle has height: 2 * this.strokeWidth
        // 4. The arrow tail's thickness is: this.strokeWidth
        // 5. The arrow head's length is: 2/3 of (point 3)
        // 6. The arrow head's thickness is: (point 3)
        // 7. The arrow generated is centered in its local (0,0), meaning that
        //    two points are placed with negative x values, and all other have
        //    positive x values:
        //
        //                            (3)\
        //                              \  \
        //             (1)-------------(2)   \
        //              |         (0)        (4)
        //             (7)-------------(6)   /
        //                              /  /
        //                            (5)/
        //

        var sizeX = this.size.x;
        var sizeY = this.size.y;
        var sizeYOver3 = sizeY/3;
        var strokeWidth = this.style['stroke-width'];
        var tailW = sizeX - strokeWidth * 3;
        var headW = sizeX - tailW;
        var spikeOffset = strokeWidth * 0.3;

        return [
            'M', -sizeX * 0.5        , -sizeY * 0.5 + sizeYOver3,    // (1)
            'l',  tailW              ,  0,                           // (2)
            'l', -spikeOffset        , -sizeYOver3,                  // (3)
            'l',  headW + spikeOffset,  sizeYOver3 * 1.5,            // (4)
            'l', -headW - spikeOffset,  sizeYOver3 * 1.5,            // (5)
            'l',  spikeOffset        , -sizeYOver3,                  // (6)
            'l', -tailW              ,  0,                           // (7)
            'z'
        ];
    };

