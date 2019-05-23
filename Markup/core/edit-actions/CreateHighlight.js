'use strict';

import { EditAction } from './EditAction'
import { MarkupHighlight } from '../MarkupHighlight'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param locations
     * @param style
     * @constructor
     */
    export function CreateHighlight(editor, id, position, size, rotation, locations, style) {

        EditAction.call(this, editor, 'CREATE-HIGHLIGHT', id);

        this.selectOnExecution = false;
        this.position = position;
        this.size = size;
        this.rotation = rotation;
        this.movements = locations.slice(0);
        this.style = cloneStyle(style);
    }

    CreateHighlight.prototype = Object.create(EditAction.prototype);
    CreateHighlight.prototype.constructor = CreateHighlight;

    var proto = CreateHighlight.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var highlight = new MarkupHighlight(this.targetId, editor);

        editor.addMarkup(highlight);

        highlight.set(this.position, this.size, this.movements, false);
        highlight.setRotation(this.rotation);
        highlight.setStyle(this.style);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };


