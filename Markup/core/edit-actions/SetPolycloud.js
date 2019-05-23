'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param polycloud
     * @param position
     * @param size
     * @param locations
     * @param closed
     * @constructor
     */
    export function SetPolycloud(editor, polycloud, position, size, locations, closed) {

        EditAction.call(this, editor, 'SET-POLYCLOUD', polycloud.id);

        this.position = position;
        this.size = size;
        this.locations = locations.concat();
        this.closed = closed;

        // No need to save old data
    }

    SetPolycloud.prototype = Object.create(EditAction.prototype);
    SetPolycloud.prototype.constructor = SetPolycloud;

    var proto = SetPolycloud.prototype;

    proto.redo = function() {

        var polycloud = this.editor.getMarkup(this.targetId);
        if(!polycloud) {
            return;
        }

        polycloud.set(this.position, this.size, this.locations, this.closed);
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

