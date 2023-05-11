'use strict';

import { EditMode } from './EditMode';
import { DeleteStamp } from '../edit-actions/DeleteStamp';
import { CreateStamp } from '../edit-actions/CreateStamp';
import { SetStamp } from '../edit-actions/SetStamp';
import * as MarkupTypes from '../MarkupTypes';

export { EditModeStamp };

class EditModeStamp extends EditMode {
    constructor(editor, svgData) {
        var styleAttributes = [
            'text-data'
        ];
        super(editor, MarkupTypes.MARKUP_TYPE_STAMP, styleAttributes);
        this.svgData = svgData;
    }

    deleteMarkup(markup, cantUndo) {
        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var deleteStamp = new DeleteStamp(this.editor, markup);
            deleteStamp.addToHistory = !cantUndo;
            deleteStamp.execute();
            return true;
        }
        return false;
    }

    onMouseMove(event) {
        if (!EditMode.prototype.onMouseMove.call( this, event )) {
            return false;
        }

        const { selectedMarkup, editor } = this; 

        let final = this.getFinalMouseDraggingPosition();
        final = editor.clientToMarkups(final.x, final.y);
        let position = {
            x: (this.firstPosition.x + final.x) / 2,
            y: (this.firstPosition.y + final.y) / 2
        };
        let size = this.size = {
            x: Math.abs(final.x - this.firstPosition.x),
            y: Math.abs(final.y - this.firstPosition.y)
        };

        const action = new SetStamp(editor, selectedMarkup, position, size);
        action.execute();
        return true;
    }

    onMouseDown() {
        EditMode.prototype.onMouseDown.call(this);

        if (this.selectedMarkup) {
            return;
        }

        const editor = this.editor;
        let mousePosition = editor.getMousePosition();

        this.initialX = mousePosition.x;
        this.initialY = mousePosition.y;
        this.firstPosition = editor.clientToMarkups(this.initialX, this.initialY);
        this.size = editor.sizeFromClientToMarkups(1, 1);

        editor.beginActionGroup();
        const markupId = editor.getId();
        const action = new CreateStamp(editor, markupId, this.firstPosition, this.size, 0, this.style, this.svgData);
        action.execute();
        
        // maybe this isn't being called right, that would explain it
        this.selectedMarkup = editor.getMarkup(markupId);
        this.creationBegin();
    }
}
