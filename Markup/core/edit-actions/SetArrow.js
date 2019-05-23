'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param arrow
     * @param head
     * @param tail
     * @constructor
     */
    export function SetArrow(editor, arrow, head, tail) {

        EditAction.call(this, editor, 'SET-ARROW', arrow.id);

        this.newHead = {x: head.x, y: head.y};
        this.newTail = {x: tail.x, y: tail.y};
        this.oldHead = {x: arrow.head.x, y: arrow.head.y};
        this.oldTail = {x: arrow.tail.x, y: arrow.tail.y};
    }

    SetArrow.prototype = Object.create(EditAction.prototype);
    SetArrow.prototype.constructor = SetArrow;

    var proto = SetArrow.prototype;

    proto.redo = function() {

        this.applyState(this.targetId, this.newHead, this.newTail);
    };

    proto.undo = function() {

        this.applyState(this.targetId, this.oldHead, this.oldTail);
    };

    proto.merge = function(action) {

        if (this.targetId === action.targetId &&
            this.type === action.type) {

            this.newHead = action.newHead;
            this.newTail = action.newTail;
            return true;
        }
        return false;
    };

    /**
     *
     * @private
     */
    proto.applyState = function(targetId, head, tail) {

        var arrow = this.editor.getMarkup(targetId);
        if(!arrow) {
            return;
        }

        // Different stroke widths make positions differ at sub-pixel level.
        var epsilon = 0.0001;

        if (Math.abs(arrow.head.x - head.x) >= epsilon || Math.abs(arrow.head.y - head.y) >= epsilon ||
            Math.abs(arrow.tail.x - tail.x) >= epsilon || Math.abs(arrow.tail.y - tail.y) >= epsilon) {

            // Confusing naming here. in arrow.set the first two numbers are
            // the point you drag from and the second two are the point you
            // drag to. So the head point is actually where the tail of the
            // arrow is positioned and the tail point is the head is positioned.
            arrow.set(head.x, head.y, tail.x, tail.y);
        }
    };

    /**
     * @returns {boolean}
     */
    proto.isIdentity = function() {

        return (
            this.newHead.x === this.oldHead.x &&
            this.newHead.y === this.oldHead.y &&
            this.newTail.x === this.oldTail.x &&
            this.newTail.y === this.oldTail.y);
    };

