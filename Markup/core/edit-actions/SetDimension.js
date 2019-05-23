'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param dimension
     * @param firstAnchor
     * @param secondAnchor
     * @constructor
     */
    export function SetDimension(editor, dimension, firstAnchor, secondAnchor, text) {

        EditAction.call(this, editor, 'SET-DIMENSION', dimension.id);

        this.newFirstAnchor = {x: firstAnchor.x, y: firstAnchor.y};
        this.newSecondAnchor = {x: secondAnchor.x, y: secondAnchor.y};   
        this.oldFirstAnchor = {x: dimension.firstAnchor.x, y: dimension.firstAnchor.y};
        this.oldSecondAnchor = {x: dimension.secondAnchor.x, y: dimension.secondAnchor.y}; 
        this.newText = text;
        this.oldText = dimension.currentText;
    }

    SetDimension.prototype = Object.create(EditAction.prototype);
    SetDimension.prototype.constructor = SetDimension;

    var proto = SetDimension.prototype;

    proto.redo = function() {

        this.applyState(this.newFirstAnchor, this.newSecondAnchor, this.newText);    

    };

    proto.undo = function() {

        this.applyState(this.oldFirstAnchor, this.oldSecondAnchor, this.oldText);

    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newFirstAnchor = action.newFirstAnchor;
            this.newSecondAnchor = action.newSecondAnchor;
            this.newText = action.newText;
            return true;
        }
        return false;
    };

    /**
     *
     * @private
     */
    proto.applyState = function(firstAnchor, secondAnchor, text) {

        var dimension = this.editor.getMarkup(this.targetId);

        if(!dimension) {
            return;
        }

        dimension.set(firstAnchor.x, firstAnchor.y, secondAnchor.x, secondAnchor.y, text);

    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        return ((this.newText === this.oldText) && (
            !this.newFirstAnchor || !this.newSecondAnchor ||
            this.newFirstAnchor.x === this.oldFirstAnchor.x &&
            this.newFirstAnchor.y === this.oldFirstAnchor.y &&
            this.newSecondAnchor.x === this.oldSecondAnchor.x &&
            this.newSecondAnchor.y === this.oldSecondAnchor.y));
    };
