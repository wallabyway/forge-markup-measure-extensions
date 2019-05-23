'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param freehand
     * @param position
     * @param size
     * @param locations
     * @constructor
     */
    export function SetFreehand(editor, freehand, position, size, locations, isAbsoluteCoords) {

        EditAction.call(this, editor, 'SET-FREEHAND', freehand.id);

        this.position = position;
        this.size = size;
        this.locations = isAbsoluteCoords ? locations : locations.slice(0);
        this.isAbsoluteCoords = isAbsoluteCoords;

        // No need to save old data
    }

    SetFreehand.prototype = Object.create(EditAction.prototype);
    SetFreehand.prototype.constructor = SetFreehand;

    var proto = SetFreehand.prototype;

    proto.redo = function() {

        var freehand = this.editor.getMarkup(this.targetId);
        if (!freehand) {
            return;
        }

        freehand.set(this.position, this.size, this.locations, this.isAbsoluteCoords);
    };

    proto.undo = function() {
        // No need for undo.
    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.locations = action.isAbsoluteCoords ? action.locations : action.locations.slice(0);
            this.position = action.position;
            this.size = action.size;
            this.isAbsoluteCoords = action.isAbsoluteCoords;
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
