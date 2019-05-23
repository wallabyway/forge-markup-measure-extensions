'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param rectangle
     * @param position
     * @param size
     * @constructor
     */
    export function SetRectangle(editor, rectangle, position, size) {

        EditAction.call(this, editor, 'SET-RECTANGLE', rectangle.id);

        this.newPosition = {x: position.x, y: position.y};
        this.newSize = {x: size.x, y: size.y};
        this.oldPosition = {x: rectangle.position.x, y: rectangle.position.y};
        this.oldSize = {x: rectangle.size.x, y: rectangle.size.y};
    }

    SetRectangle.prototype = Object.create(EditAction.prototype);
    SetRectangle.prototype.constructor = SetRectangle;

    var proto = SetRectangle.prototype;

    proto.redo = function() {

        this.applyState(this.targetId, this.newPosition, this.newSize);
    };

    proto.undo = function() {

        this.applyState(this.targetId, this.oldPosition, this.oldSize);
    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newPosition = action.newPosition;
            this.newSize = action.newSize;
            return true;
        }
        return false;
    };

    /**
     *
     * @private
     */
    proto.applyState = function(targetId, position, size) {

        var rectangle = this.editor.getMarkup(targetId);
        if(!rectangle) {
            return;
        }

        // Different stroke widths make positions differ at sub-pixel level.
        var epsilon = 0.0001;

        if (Math.abs(rectangle.position.x - position.x) > epsilon || Math.abs(rectangle.size.y - size.y) > epsilon ||
            Math.abs(rectangle.position.y - position.y) > epsilon || Math.abs(rectangle.size.y - size.y) > epsilon) {

            rectangle.set(position, size);
        }
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        return(
            this.newPosition.x === this.oldPosition.x &&
            this.newPosition.y === this.oldPosition.y &&
            this.newSize.x === this.oldSize.x &&
            this.newSize.y === this.oldSize.y);
    };
