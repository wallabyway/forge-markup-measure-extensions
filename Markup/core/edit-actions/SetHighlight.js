'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param highlight
     * @param position
     * @param size
     * @param locations
     * @constructor
     */
    export function SetHighlight(editor, highlight, position, size, locations, isAbsoluteCoords) {

        EditAction.call(this, editor, 'SET-HIGHLIGHT', highlight.id);

        this.position = position;
        this.size = size;
        this.locations = isAbsoluteCoords ? locations : locations.slice(0);
        this.isAbsoluteCoords = isAbsoluteCoords;

        // No need to save old data
    }

    SetHighlight.prototype = Object.create(EditAction.prototype);
    SetHighlight.prototype.constructor = SetHighlight;

    var proto = SetHighlight.prototype;

    proto.redo = function() {

        var highlight = this.editor.getMarkup(this.targetId);
        if (!highlight) {
            return;
        }

        highlight.set(this.position, this.size, this.locations, this.isAbsoluteCoords);
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

