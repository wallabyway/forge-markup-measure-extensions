'use strict';

import { EditMode } from './EditMode'
import { DeleteRectangle } from '../edit-actions/DeleteRectangle'
import { CreateRectangle } from '../edit-actions/CreateRectangle'
import { SetRectangle } from '../edit-actions/SetRectangle'
import * as MarkupTypes from '../MarkupTypes'

    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeRectangle(editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
        EditMode.call(this, editor, MarkupTypes.MARKUP_TYPE_RECTANGLE, styleAttributes);
    }

    EditModeRectangle.prototype = Object.create(EditMode.prototype);
    EditModeRectangle.prototype.constructor = EditModeRectangle;

    var proto = EditModeRectangle.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var deleteRectangle = new DeleteRectangle(this.editor, markup);
            deleteRectangle.addToHistory = !cantUndo;
            deleteRectangle.execute();
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
        if(!selectedMarkup || !this.creating) {
            return;
        }

        var editor = this.editor;

        var pos = this.getFinalMouseDraggingPosition();
        var final = editor.clientToMarkups(pos.x, pos.y);
        var position = {x: (this.firstCorner.x + final.x) / 2, y: (this.firstCorner.y + final.y) / 2};

        var width, height;
        // Snap to parallel/perpendicular of underlying vectors
        if (editor.snapper && this.lineSnapped) {
            var start = editor.project(this.lineSnapped.vertices[0]);
            var end = editor.project(this.lineSnapped.vertices[1]);

            var startZ = start.z;

            start = editor.clientToMarkups(start.x, start.y);
            end = editor.clientToMarkups(end.x, end.y);

            start = new THREE.Vector3(start.x, start.y, startZ);
            end = new THREE.Vector3(end.x, end.y, startZ);

            var p = new THREE.Vector3(final.x, final.y, startZ);

            var parallel = MeasureCommon.nearestPointInPointToLine(p, start, end);
            height = p.distanceTo(parallel);

            // select an arbitrary point on the perpendicular line
            var k = -(start.x - end.x) / (start.y - end.y);
            var b = this.firstCorner.y - k * this.firstCorner.x;
            var x = this.firstCorner.x + 1;
            var y = k * x + b;
            var pEnd = new THREE.Vector3(x, y, startZ);

            var pStart = new THREE.Vector3(this.firstCorner.x, this.firstCorner.y, startZ);
            var perpendicular = MeasureCommon.nearestPointInPointToLine(p, pStart, pEnd);
            width = p.distanceTo(perpendicular);
        }
        else {
            width = final.x - this.firstCorner.x;
            height = final.y - this.firstCorner.y;
        }

        var size = this.size = {x: Math.abs(width), y: Math.abs(height)};

        var setRectangle = new SetRectangle(
            editor,
            selectedMarkup,
            position,
            size);

        setRectangle.execute();
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
        var mousePosition = editor.getMousePosition();

        this.initialX = mousePosition.x;
        this.initialY = mousePosition.y;

        // Calculate center and size.
        var position = this.firstCorner = editor.clientToMarkups(this.initialX, this.initialY);
        var size = this.size = editor.sizeFromClientToMarkups(1, 1);

        // Calculate rotation
        var rotation = 0;
        this.lineSnapped = null;
        if (editor.snapper) {
            // Snap to parallel/perpendicular of underlying vectors
            var geomType = editor.snapper.getGeometryType();
            if (geomType === MeasureCommon.SnapType.SNAP_EDGE) {
                this.lineSnapped = editor.snapper.getEdge();
                var start = editor.project(this.lineSnapped.vertices[0]);
                var end = editor.project(this.lineSnapped.vertices[1]);
                var dx = end.x - start.x;
                var dy = end.y - start.y;
                rotation = this.rotation = Math.atan2(dy, dx);
            }
        }

        // Create rectangle.
        editor.beginActionGroup();

        var markupId = editor.getId();
        var create = new CreateRectangle(
            editor,
            markupId,
            position,
            size,
            rotation,
            this.style);

        create.execute();

        this.selectedMarkup = editor.getMarkup(markupId);
        this.creationBegin();
    };

