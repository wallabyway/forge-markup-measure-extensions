'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param polyline
     * @param position
     * @param size
     * @param locations
     * @param closed
     * @constructor
     */
    export function SetPolyline(editor, polyline, position, size, locations, closed) {

        EditAction.call(this, editor, 'SET-POLYLINE', polyline.id);

        this.position = position;
        this.size = size;
        this.locations = locations.concat();
        this.closed = closed;

        // No need to save old data
    }

    SetPolyline.prototype = Object.create(EditAction.prototype);
    SetPolyline.prototype.constructor = SetPolyline;

    var proto = SetPolyline.prototype;

    proto.redo = function() {

        var polyline = this.editor.getMarkup(this.targetId);
        if(!polyline) {
            return;
        }

        polyline.set(this.position, this.size, this.locations, this.closed);
    };

    proto.undo = function() {
        // No need for undo.
    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.locations = action.locations.concat();
            this.position = action.position;
            this.size = action.size;
            this.closed = action.closed;
            return true;
        }
        return false;
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        return false; // No need to optimize, always false.
    };

