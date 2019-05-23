'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param markup
     * @param position
     * @param width
     * @param height
     * @constructor
     */
    export function SetSize(editor, markup, position, width, height) {

        EditAction.call(this, editor, 'SET-SIZE', markup.id);

        this.newPosition = {x: position.x, y: position.y};
        this.oldPosition = {x: markup.position.x, y: markup.position.y};
        this.newWidth = width;
        this.oldWidth = markup.size.x;
        this.newHeight = height;
        this.oldHeight = markup.size.y;
    }

    SetSize.prototype = Object.create(EditAction.prototype);
    SetSize.prototype.constructor = SetSize;

    var proto = SetSize.prototype;

    proto.redo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setSize(this.newPosition, this.newWidth, this.newHeight);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setSize(this.oldPosition, this.oldWidth, this.oldHeight);
    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newPosition = action.newPosition;
            this.newWidth = action.newWidth;
            this.newHeight = action.newHeight;
            return true;
        }
        return false;
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        var identity =
            this.newPosition.x === this.oldPosition.x &&
            this.newPosition.y === this.oldPosition.y &&
            this.newWidth === this.oldWidth &&
            this.newHeight === this.oldHeight;

        return identity;
    };
