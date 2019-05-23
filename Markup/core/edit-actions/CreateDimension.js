'use strict';

import { EditAction } from './EditAction'
import { MarkupDimension } from '../MarkupDimension'
import { cloneStyle } from '../StyleUtils'

    /**
     * @constructor
     */
    export function CreateDimension(editor, id, firstAnchor, secondAnchor, text, style) {

        EditAction.call(this, editor, 'CREATE-DIMENSION', id);

        this.selectOnExecution = false;
        this.secondAnchor = secondAnchor;
        this.firstAnchor = firstAnchor;
        this.text = text;
        this.style = cloneStyle(style);
    }

    CreateDimension.prototype = Object.create(EditAction.prototype);
    CreateDimension.prototype.constructor = CreateDimension;

    var proto = CreateDimension.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var dimension = new MarkupDimension(this.targetId, editor);

        editor.addMarkup(dimension);

        // Don't display the dimension markup when there is only one Anchor (First click, before mouse move).
        if (this.secondAnchor) {
            dimension.set(this.firstAnchor.x, this.firstAnchor.y, this.secondAnchor.x, this.secondAnchor.y, this.text);
            dimension.setStyle(this.style);
        }        
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };


