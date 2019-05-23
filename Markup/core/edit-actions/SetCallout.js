'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param markup
     * @param position
     * @param size
     * @param text
     * @constructor
     */
    export function SetCallout(editor, markup, position, size, text, isFrameUsed) {

        EditAction.call(this, editor, 'SET-CALLOUT', markup.id);

        this.newPosition = {x: position.x, y: position.y};
        this.oldPosition = {x: markup.position.x, y: markup.position.y};
        this.newSize = {x: size.x, y: size.y};
        this.oldSize = {x: markup.size.x, y: markup.size.y};
        this.newText = text;
        this.oldText = markup.getText();
        this.newIsFrameUsed = isFrameUsed;
        this.oldIsFrameUsed = markup.isFrameUsed;
    }

    SetCallout.prototype = Object.create(EditAction.prototype);
    SetCallout.prototype.constructor = SetCallout;

    var proto = SetCallout.prototype;

    proto.redo = function() {

        var callout = this.editor.getMarkup(this.targetId);
        callout && callout.set(this.newPosition, this.newSize, this.newText, this.newIsFrameUsed);
    };

    proto.undo = function() {

        var callout = this.editor.getMarkup(this.targetId);
        callout && callout.set(this.oldPosition, this.oldSize, this.oldText, this.oldIsFrameUsed);
    };
