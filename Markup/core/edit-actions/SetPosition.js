'use strict';

import { EditAction } from './EditAction'

    export function SetPosition(editor, markup, position) {

        EditAction.call(this, editor, 'SET-POSITION', markup.id);

        this.newPosition = {x: position.x, y: position.y};
        this.oldPosition = {x: markup.position.x, y: markup.position.y};
    }

    SetPosition.prototype = Object.create(EditAction.prototype);
    SetPosition.prototype.constructor = SetPosition;

    var proto = SetPosition.prototype;

    proto.redo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setPosition(this.newPosition.x, this.newPosition.y);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setPosition(this.oldPosition.x, this.oldPosition.y);
    };

    /**
     *
     * @param action
     * @returns {boolean}
     */
    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newPosition = action.newPosition;
            return true;
        }
        return false;
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        var newPosition = this.newPosition;
        var oldPosition = this.oldPosition;

        return newPosition.x === oldPosition.x && newPosition.y === oldPosition.y;
    };

