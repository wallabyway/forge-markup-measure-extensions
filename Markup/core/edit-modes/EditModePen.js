'use strict';

import { EditMode } from './EditMode'
import { simplify } from '../MarkupsCoreUtils'

    /**
     * Base class for editing Pen tools (currently freehand and highlighter)
     *
     * Any class extending EditModePen should contain at least the following methods:
     * - createPen()
     * - deletePen()
     * - setPen()
     *
     * @param editor
     * @constructor
     */
    export function EditModePen(editor, type, styleAttributes) {
        EditMode.call(this, editor, type, styleAttributes);

        this.smoothen = true;
        this.bufferSize = 8;
    }

    EditModePen.prototype = Object.create(EditMode.prototype);

    var proto = EditModePen.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type === this.type) {
            var deleteMarkup = this.deletePen(markup);
            deleteMarkup.addToHistory = !cantUndo;
            deleteMarkup.execute();
            return true;
        }
        return false;
    };

    /**
     * Handler to mouse move events, used to create markups.
     * @param {MouseEvent} event Mouse event.
     * @private
     */
    proto.onMouseMove = function(event) {

        EditMode.prototype.onMouseMove.call( this, event );

        var selectedMarkup = this.selectedMarkup;
        if (!selectedMarkup || !this.creating) {
            return;
        }

        var editor = this.editor;
        var mousePosition = editor.getMousePosition();
        var movements = this.movements;

        var location = editor.clientToMarkups(mousePosition.x, mousePosition.y);
        if (this.smoothen) {
            this.appendToBuffer(location);
            this.amendPath();
        } else {
            var dx = this.lastX - mousePosition.x;
            var dy = this.lastY - mousePosition.y;
            var moveTol = 25; // 5^2, compare to square to avoid using square root of distance

            if (movements.length > 1 && (dx*dx + dy*dy) < moveTol) {
                movements[movements.length - 1] = location;
                this.removeFromAbsolutePath(1);
            } else {
                movements.push(location);
                this.lastX = mousePosition.x;
                this.lastY = mousePosition.y;
            }

            this.addToAbsolutePath([location]);
        }

        var setPen = this.setPen(this.position, this.size, this.absolutePath, true);
        setPen.execute();
    };

    /**
     * Handler to mouse down events, used to start markups creation.
     * @private
     */
    proto.onMouseDown = function() {

        EditMode.prototype.onMouseDown.call(this);

        if (this.selectedMarkup) {
            return;
        }

        var editor = this.editor;

        editor.snapper && editor.snapper.clearSnapped();
        var mousePosition = editor.getMousePosition();

        this.lastX = this.initialX = mousePosition.x;
        this.lastY = this.initialY = mousePosition.y;

        //set the starting point
        var position = this.position = editor.clientToMarkups(this.initialX, this.initialY);
        this.movements = [position];
        if (this.smoothen) {
            this.buffer = []; // Reset buffer
            this.movementsLastIndex = null;
            this.appendToBuffer(position);
        }

        var size = this.size = editor.sizeFromClientToMarkups(1, 1);

        // Create pen.
        editor.beginActionGroup();

        var markupId = editor.getId();
        var create = this.createPen(markupId, position, size, 0, [{x: 0, y: 0 }]);

        create.execute();

        this.createAbsolutePath(position);

        this.selectedMarkup = editor.getMarkup(markupId);
        this.creationBegin();
    };

    proto.onMouseUp = function() {

        if (!this.creating) {
            EditMode.prototype.onMouseUp.call(this);
            return;
        }

        var movements = this.movements;
        var cameraWidth = this.viewer.impl.camera.right - this.viewer.impl.camera.left;
        var cameraHeight = this.viewer.impl.camera.top - this.viewer.impl.camera.bottom;
        var cameraDiagSq = cameraWidth*cameraWidth + cameraHeight*cameraHeight;

        movements = simplify(movements, cameraDiagSq * 0.00000001, true);

        var xs = movements.map(function(item) { return item.x });
        var ys = movements.map(function(item) { return item.y });

        var l = Math.min.apply(null, xs);
        var t = Math.min.apply(null, ys);
        var r = Math.max.apply(null, xs);
        var b = Math.max.apply(null, ys);

        var width = r - l;  // Already in markup coords space
        var height = b - t; // Already in markup coords space

        var position = {
            x: l + width * 0.5,
            y: t + height * 0.5
        };
        var size = this.size = {x: width, y: height};

        // Adjust points to relate from the shape's center
        var locations = movements.map(function(point){
            return {
                x: point.x - position.x,
                y: point.y - position.y
            };
        });

        var setPen = this.setPen(position, size, locations, false);
        setPen.execute();

        EditMode.prototype.onMouseUp.call(this);
    };

    proto.createPen = function() {
        console.error('createPen not implemented');
    };

    proto.deletePen = function() {
        console.error('deletePen not implemented');
    };

    proto.setPen = function() {
        console.error('setPen not implemented');
    };

    proto.useWithSnapping = function () {
        return false;
    };

    proto.createAbsolutePath = function(point) {

        this.absolutePath = 'M' + +(point.x).toFixed(6) + ' ' + +(point.y).toFixed(6);
        this.absolutePathIndexes = [0];
    };

    proto.removeFromAbsolutePath = function(numToRemove) {

        numToRemove = Math.min(numToRemove, this.absolutePathIndexes.length);
        if (numToRemove > 0) {
            this.absolutePath = this.absolutePath.slice(0, this.absolutePathIndexes[this.absolutePathIndexes.length - numToRemove]);
            this.absolutePathIndexes.splice(this.absolutePathIndexes.length - numToRemove);
        }
    };

    proto.addToAbsolutePath = function(points) {

       for (var i = 0; i < points.length; i++) {
            this.absolutePathIndexes.push(this.absolutePath.length);
            this.absolutePath += ' L' + +(points[i].x).toFixed(6) + ' ' + +(points[i].y).toFixed(6);
        }
    };

    proto.appendToBuffer = function(point) {

        this.buffer.push(point);
        while (this.buffer.length > this.bufferSize) {
            this.buffer.shift();
        }
    };

    proto.amendPath = function() {

        var point = this.getAveragePoint(0);
        if (point) {
            if (this.movementsLastIndex) {
                this.removeFromAbsolutePath(this.movements.length - this.movementsLastIndex);
                this.movements.splice(this.movementsLastIndex);
            }

            // Add the smoothed part of the path that will not change
            var tmpBuffer = [point];
            this.movementsLastIndex = this.movements.length + 1;

            // Get the last part of the path (close to the current mouse position)
            // This part will change if the mouse moves again
            for (var offset = 2; offset < this.buffer.length; offset += 2) {
                var pt = this.getAveragePoint(offset);
                tmpBuffer.push(pt);
            }

            this.addToAbsolutePath(tmpBuffer);

            // Set the complete current path coordinates
            this.movements.push.apply(this.movements, tmpBuffer);

        }
    };

    // Calculate the average point, starting at offset in the buffer
    proto.getAveragePoint = function(offset) {

        var len = this.buffer.length;
        if (len % 2 === 1 || len >= this.bufferSize) {
            var totalX = 0;
            var totalY = 0;
            var pt;
            var count = 0;
            for (var i = offset; i < len; i++) {
                count++;
                pt = this.buffer[i];
                totalX += pt.x;
                totalY += pt.y;
            }
            return {
                x: totalX / count,
                y: totalY / count
            }
        }
        return null;
    };

