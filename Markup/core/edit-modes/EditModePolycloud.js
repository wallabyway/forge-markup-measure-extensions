'use strict';

import { EditMode } from './EditMode'
import { DeletePolycloud } from '../edit-actions/DeletePolycloud'
import { CreatePolycloud } from '../edit-actions/CreatePolycloud'
import { SetPolycloud } from '../edit-actions/SetPolycloud'
import * as MarkupTypes from '../MarkupTypes'
import { areMarkupsPointsInClientRange } from '../MarkupsCoreUtils'

    var SNAP_RANGE = 25;

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModePolycloud(editor) {

        var styleAttributes = ['stroke-width', 'stroke-color','stroke-opacity', 'fill-color', 'fill-opacity'];
        EditMode.call(this, editor, MarkupTypes.MARKUP_TYPE_POLYCLOUD, styleAttributes);

        this.creationMethod = this.CREATION_METHOD_CLICKS;
        this.movements = [];
    }

    EditModePolycloud.prototype = Object.create(EditMode.prototype);
    EditModePolycloud.prototype.constructor = EditModePolycloud;

    var proto = EditModePolycloud.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var movements = this.movements;
            if (this.creating && movements.length >= 2) {
                movements.pop();
                movements.pop();
                var lastIndex = movements.length - 1;
                if (lastIndex >= 0) {
                    // duplicate last location
                    var lastMove = movements[lastIndex];
                    movements.push(lastMove);
                    var locations = setPositionAndSize(movements, this);
                    var setPolycloud = new SetPolycloud(
                        this.editor,
                        markup,
                        this.position,
                        this.size,
                        locations);

                    setPolycloud.execute();
                }
            }
            else {
                var deletePolycloud = new DeletePolycloud(this.editor, markup);
                deletePolycloud.addToHistory = !cantUndo;
                deletePolycloud.execute();
                this.creationEnd();
                return true;
            }
        }
        return false;
    };

    /**
     * Handler to mouse move events, used to create markups.
     * @param {MouseEvent} event Mouse event.
     * @private
     */
    proto.onMouseMove = function(event) {

        EditMode.prototype.onMouseMove.call(this, event);

        var editor = this.editor;
        var selectedMarkup = this.selectedMarkup;

        if(!selectedMarkup || !this.creating) {
            return;
        }

        this.dragging = true;

        var movements = this.movements;
        movements.splice(movements.length-1, 1);

        var mousePosition = editor.getMousePosition();
        mousePosition = editor.clientToMarkups(mousePosition.x, mousePosition.y);

        // Close polycloud if user clicks close to initial point.
        if (movements.length >= 2 &&
            areMarkupsPointsInClientRange(movements[0], mousePosition, SNAP_RANGE, this.editor)) {
            mousePosition = movements[0]; // Snap!
        }

        movements.push(mousePosition);

        var locations = setPositionAndSize(movements, this);
        var setPolycloud = new SetPolycloud(
            editor,
            selectedMarkup,
            this.position,
            this.size,
            locations);

        setPolycloud.execute();
    };

    /**
     * Handler to mouse down events, used to start markups creation.
     * @private
     */
    proto.onMouseDown = function() {

        EditMode.prototype.onMouseDown.call(this);

        // User selected an already created markup.
        if (this.selectedMarkup && !this.creating) {
            return;
        }

        if (this.creating) {
            return;
        }

        // Creation process.
        var editor = this.editor;
        var mousePosition = editor.getMousePosition();

        mousePosition = editor.clientToMarkups(mousePosition.x, mousePosition.y);

        var size = this.size = editor.sizeFromClientToMarkups(1, 1);
        this.movements = [mousePosition, mousePosition];

        editor.beginActionGroup();

        var markupId = editor.getId();
        var create = new CreatePolycloud(
            editor,
            markupId,
            mousePosition,
            size,
            0,
            [{x: 0, y: 0 }],
            this.style);

        create.execute();

        this.selectedMarkup = editor.getMarkup(markupId);
        this.creationBegin();
    };

    /**
     * Handler to mouse down events, used to start markups creation.
     * @private
     */
    proto.onMouseUp = function(event) {

        EditMode.prototype.onMouseUp.call(this);

        if(!this.creating) {
            return;
        }

        this.dragging = false;

        // Creation process.
        var editor = this.editor;
        var mousePosition = editor.getMousePosition();
        var movements = this.movements;
        var closed = false;

        mousePosition = editor.clientToMarkups(mousePosition.x, mousePosition.y);

        if (movements.length > 1 &&
            areMarkupsPointsInClientRange(movements[movements.length-2], mousePosition, SNAP_RANGE, this.editor)) {
            return;
        }

        // Close polycloud if user clicks close to initial point.
        if (movements.length > 2 &&
            areMarkupsPointsInClientRange(movements[0], mousePosition, SNAP_RANGE, this.editor)) {
            mousePosition = movements[0]; // Snap!
            closed = true;
        }

        movements.splice(movements.length-1, 1);

        if (!closed) {
            movements.push(mousePosition);
            movements.push(mousePosition);
        }

        var polycloud = this.selectedMarkup;
        var locations = setPositionAndSize(movements, polycloud);
        var setPolycloud = new SetPolycloud(
            editor,
            polycloud,
            polycloud.position,
            polycloud.size,
            locations,
            closed);

        setPolycloud.execute();

        if (closed) {
            this.creationEnd();
        }
    };

    proto.onMouseDoubleClick = function(event) {

        if(!this.creating) {
            return;
        }

        var movements = this.movements;
        movements.splice(Math.max(0, movements.length-1));

        if (movements.length < 2 ) {

            this.creationCancel();
        } else {

            var polycloud = this.selectedMarkup;
            var locations = setPositionAndSize(movements, polycloud);
            var setPolycloud = new SetPolycloud(
                this.editor,
                polycloud,
                polycloud.position,
                polycloud.size,
                locations,
                true);

            setPolycloud.execute();
            this.creationEnd();
        }
    };

    proto.destroy = function() {
        this.onMouseDoubleClick();
        EditMode.prototype.creationEnd.call(this);
        EditMode.prototype.destroy.call(this);
    };

    proto.creationEnd = function() {

        // To pass isMinSizeValid,
        // probably that test should be done with the markup size (not the recorded by the edit mode).
        if (this.selectedMarkup) {
            this.size.x = this.selectedMarkup.size.x;
            this.size.y = this.selectedMarkup.size.y;
        }
        
        EditMode.prototype.creationEnd.call(this);

        this.closed = false;
        this.movements = [];
        this.dragging = false;
        this.creating = false;
    };

    proto.creationCancel = function() {

        EditMode.prototype.creationCancel.call(this);

        this.closed = false;
        this.movements = [];
        this.dragging = false;
        this.creating = false;
    };

    function setPositionAndSize(locations, markup) {

        // determine the position of the top-left and bottom-right points
        var minFn = function(collection, key){
            var targets = collection.map(function(item){
                return item[key];
            });
            return Math.min.apply(null, targets);
        };

        var maxFn = function(collection, key){
            var targets = collection.map(function(item){
                return item[key];
            });
            return Math.max.apply(null, targets);
        };

        var strokeWidth = markup.style['stroke-width'];
        var radius = strokeWidth * 2 + strokeWidth * 0.5;

        var l = minFn(locations, 'x') - radius;
        var t = minFn(locations, 'y') - radius;
        var r = maxFn(locations, 'x') + radius;
        var b = maxFn(locations, 'y') + radius;
        var w = r - l;
        var h = b - t;

        markup.size = {x: w, y: h};
        markup.position = {x: l + w * 0.5, y: t + h * 0.5};

        // Adjust points to relate from the shape's center
        var position = markup.position;
        return locations.map(function(point){
            return {
                x: point.x - position.x,
                y: point.y - position.y
            };
        });
    }
