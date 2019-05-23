'use strict';

import { EditAction } from './EditAction'
import { MarkupCallout } from '../MarkupCallout'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param text
     * @param style
     * @constructor
     */
    export function CreateCallout(editor, id, position, size, text, style, isFrameUsed) {

        EditAction.call(this, editor, 'CREATE-CALLOUT', id);

        this.text = text;
        this.position = {x: position.x, y: position.y};
        this.size = {x: size.x, y: size.y};
        this.style = cloneStyle(style);
        this.isFrameUsed = isFrameUsed;
    }

    CreateCallout.prototype = Object.create(EditAction.prototype);
    CreateCallout.prototype.constructor = CreateCallout;

    var proto = CreateCallout.prototype;

    proto.redo = function () {

        var editor = this.editor;
        var position = this.position;
        var size = this.size;

        var callout = new MarkupCallout(this.targetId, editor, size);

        editor.addMarkup(callout);

        callout.setIsFilledFrameUsed(this.isFrameUsed);
        callout.setText(this.text);
        callout.setSize(position, size.x, size.y);
        callout.setStyle(this.style);
    };

    proto.undo = function () {

        var markup = this.editor.getMarkup(this.targetId);
        if (markup) {
            this.editor.removeMarkup(markup);
            markup.destroy();
        }
    };

