'use strict';

import { EditMode } from './EditMode'
import { DeleteCloud } from '../edit-actions/DeleteCloud'
import { CreateCloud } from '../edit-actions/CreateCloud'
import { SetCloud } from '../edit-actions/SetCloud'
import * as MarkupTypes from '../MarkupTypes'

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeCloud(editor) {

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
        EditMode.call(this, editor, MarkupTypes.MARKUP_TYPE_CLOUD, styleAttributes);
    }

    EditModeCloud.prototype = Object.create(EditMode.prototype);
    EditModeCloud.prototype.constructor = EditModeCloud;

    var proto = EditModeCloud.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var deleteCloud = new DeleteCloud(this.editor, markup);
            deleteCloud.addToHistory = !cantUndo;
            deleteCloud.execute();
            return true;
        }
        return false;
    };

    /**
     * Handler to mouse move events, used to create markups.
     * @param {MouseEvent} event Mouse event.
     * @private
     */
    proto.onMouseMove = function(event) {

        EditMode.prototype.onMouseMove.call( this, event );

        var selectedMarkup = this.selectedMarkup;
        if(!selectedMarkup || !this.creating) {
            return;
        }

        var editor = this.editor;

        var pos = this.getFinalMouseDraggingPosition();
        var final = editor.clientToMarkups(pos.x, pos.y);
        var position = { x: (this.firstPosition.x + final.x) / 2, y: (this.firstPosition.y + final.y) / 2 };
        var size = this.size = { x: Math.abs(final.x - this.firstPosition.x), y: Math.abs(final.y - this.firstPosition.y) };
        var setCloud = new SetCloud(
            editor,
            selectedMarkup,
            position,
            size);

        setCloud.execute();
    };

    /**
     * Handler to mouse down events, used to start markups creation.
     * @private
     */
    proto.onMouseDown = function() {

        EditMode.prototype.onMouseDown.call(this);

        if (this.selectedMarkup) {
            return;
        }

        var editor = this.editor;
        var mousePosition = editor.getMousePosition();

        this.initialX = mousePosition.x;
        this.initialY = mousePosition.y;

        // Calculate center and size.
        var position = this.firstPosition = editor.clientToMarkups(this.initialX, this.initialY);
        var size = this.size = editor.sizeFromClientToMarkups(1, 1);

        // Create Cloud.
        editor.beginActionGroup();

        var markupId = editor.getId();
        var create = new CreateCloud(
            editor,
            markupId,
            position,
            size,
            0,
            this.style);

        create.execute();

        this.selectedMarkup = editor.getMarkup(markupId);
        this.creationBegin();
    };

