'use strict';

import { EditAction } from './EditAction'

    /**
     *
     * @param editor
     * @param id
     * @param markup
     * @param position
     * @constructor
     */
    export function CloneMarkup(editor, id, markup, position) {

        EditAction.call(this, editor, 'CLONE-MARKUP', id);

        this.clone = markup.clone();
        this.clone.id = id;
        this.position = {x: position.x, y: position.y};
    }

    CloneMarkup.prototype = Object.create(EditAction.prototype);
    CloneMarkup.prototype.constructor = CloneMarkup;

    var proto = CloneMarkup.prototype;

    proto.redo = function() {

        var editor = this.editor;
        var clone = this.clone;
        var position = this.position;

        if (editor.getMarkup(this.targetId)) {
            return;
        }

        var markup = clone.clone();
        markup.setPosition(position.x, position.y);

        editor.addMarkup(markup);
    };

    proto.undo = function() {

        var markup = this.editor.getMarkup(this.targetId);
        markup && this.editor.removeMarkup(markup);
    };


