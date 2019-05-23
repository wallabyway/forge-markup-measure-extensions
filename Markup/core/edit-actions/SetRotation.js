'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param markup
     * @param angle
     * @constructor
     */
    export function SetRotation(editor, markup, angle) {

        EditAction.call(this, editor, 'SET-ROTATION', markup.id);

        var curAngle = markup.getRotation();

        this.newRotation = {angle: angle};
        this.oldRotation = {angle: curAngle};
    }

    SetRotation.prototype = Object.create(EditAction.prototype);
    SetRotation.prototype.constructor = SetRotation;

    var proto = SetRotation.prototype;

    proto.redo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setRotation(this.newRotation.angle);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setRotation(this.oldRotation.angle);
    };

    /**
     *
     * @param action
     * @returns {boolean}
     */
    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newRotation = action.newRotation;
            return true;
        }
        return false;
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        return this.newRotation.angle === this.oldRotation.angle;
    };

