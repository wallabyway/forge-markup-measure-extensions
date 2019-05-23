'use strict';

import { EditAction } from './EditAction'
import { cloneStyle } from '../StyleUtils'

    /**
     *
     * @param editor
     * @param markup
     * @param style
     * @constructor
     */
    export function SetStyle(editor, markup, style) {

        EditAction.call(this, editor, 'SET-STYLE', markup.id);

        this.newStyle = cloneStyle(style);
        this.oldStyle = markup.getStyle();
    }

    SetStyle.prototype = Object.create(EditAction.prototype);
    SetStyle.prototype.constructor = SetStyle;

    var proto = SetStyle.prototype;

    proto.redo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setStyle(this.newStyle);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && markup.setStyle(this.oldStyle);
    };
