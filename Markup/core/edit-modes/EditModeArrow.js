'use strict';

import { EditMode } from './EditMode'
import { DeleteArrow } from '../edit-actions/DeleteArrow'
import { CreateArrow } from '../edit-actions/CreateArrow'
import { SetArrow } from '../edit-actions/SetArrow'
import * as MarkupTypes from '../MarkupTypes'


    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeArrow(editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity'];
        EditMode.call(this, editor, MarkupTypes.MARKUP_TYPE_ARROW, styleAttributes);
    }

    EditModeArrow.prototype = Object.create(EditMode.prototype);
    EditModeArrow.prototype.constructor = EditModeArrow;


    var proto = EditModeArrow.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var deleteArrow = new DeleteArrow(this.editor, markup);
            deleteArrow.addToHistory = !cantUndo;
            deleteArrow.execute();
            return true;
        }
        return false;
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

        this.size.x = 0;
        this.size.y = 0;

        // Snap to parallel/perpendicular of underlying vectors
        this.lineSnapped = null;
        if (editor.snapper) {
            var geomType = editor.snapper.getGeometryType();
            if (geomType === MeasureCommon.SnapType.SNAP_VERTEX || 
                geomType === MeasureCommon.SnapType.SNAP_EDGE || 
                geomType === MeasureCommon.SnapType.SNAP_MIDPOINT || 
                geomType === MeasureCommon.SnapType.SNAP_CIRCLE_CENTER) 
            {
                this.lineSnapped = editor.snapper.getEdge();
            }
        }

        // Calculate head and tail.
        var arrowMinSize = this.style['stroke-width'] * 3.5;

        var head = this.head = editor.positionFromClientToMarkups(this.initialX, this.initialY);
        var tail = {
            x: head.x + Math.cos( Math.PI * 0.25) * arrowMinSize,
            y: head.y + Math.sin(-Math.PI * 0.25) * arrowMinSize
        };
        // Constrain head and tail inside working area.
        var constrain = function(head, tail, size, bounds) {

            if (this.isInsideBounds(tail.x, tail.y, bounds)) {
                return;
            }

            tail.y = head.y + Math.sin( Math.PI * 0.25) * size;
            if (this.isInsideBounds( tail.x, tail.y, bounds)) {
                return;
            }

            tail.x = head.x + Math.cos(-Math.PI * 0.25) * size;
            if (this.isInsideBounds( tail.x, tail.y, bounds)) {
                return;
            }

            tail.y = head.y + Math.sin(-Math.PI * 0.25) * size;

        }.bind(this);

        constrain( head, tail, arrowMinSize, editor.getBounds());

        // Create arrow.
        editor.beginActionGroup();

        var arrowVector = new THREE.Vector2(tail.x - head.x, tail.y - head.y);
        if (arrowVector.lengthSq() < arrowMinSize * arrowMinSize) {

            arrowVector = arrowVector.normalize().multiplyScalar(arrowMinSize);
            tail.x = head.x + arrowVector.x;
            tail.y = head.y + arrowVector.y;
        }

        var arrowId = editor.getId();
        var create = new CreateArrow(editor, arrowId, head, tail, this.style);
        create.execute();

        this.selectedMarkup = editor.getMarkup(arrowId);
        this.creationBegin();
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
        var final = this.getFinalMouseDraggingPosition();
        var initialX = this.initialX;
        var initialY = this.initialY;

        // Snap to parallel/perpendicular of underlying vectors
        if (editor.snapper && !editor.snapper.isSnapped() && this.lineSnapped) {
            var start = editor.project(this.lineSnapped.vertices[0]);
            var end = editor.project(this.lineSnapped.vertices[1]);
            var p = new THREE.Vector3(final.x, final.y, start.z);

            var parallel = MeasureCommon.nearestPointInPointToLine(p, start, end);

            // select an arbitrary point on the perpendicular line
            var k = -(start.x - end.x) / (start.y - end.y);
            var b = initialY - k * initialX;
            var x = initialX + 1;
            var y = k * x + b;
            var pEnd = new THREE.Vector3(x, y, start.z);

            var pStart = new THREE.Vector3(initialX, initialY, start.z);
            var perpendicular = MeasureCommon.nearestPointInPointToLine(p, pStart, pEnd);

            // Snap to parallel of underlying vectors
            if (parallel.distanceTo(p) <= 20) {
                final.x = parallel.x;
                final.y = parallel.y;
            }
            // Snap to perpendicular of underlying vectors
            else if (perpendicular.distanceTo(p) <= 20) {
                final.x = perpendicular.x;
                final.y = perpendicular.y;
            }
        }

        var head = this.head;
        var tail = editor.positionFromClientToMarkups(final.x, final.y);

        var arrowVector = new THREE.Vector2(tail.x - head.x, tail.y - head.y);
        var arrowMinSize = selectedMarkup.style['stroke-width'] * 3.5;

        if (arrowVector.lengthSq() < arrowMinSize * arrowMinSize) {

            arrowVector = arrowVector.normalize().multiplyScalar(arrowMinSize);
            tail.x = head.x + arrowVector.x;
            tail.y = head.y + arrowVector.y;
        }

        this.size = editor.sizeFromClientToMarkups((final.x - initialX), (final.y - initialY));

        var setArrow = new SetArrow(editor, selectedMarkup, head, tail);
        setArrow.execute();
    };