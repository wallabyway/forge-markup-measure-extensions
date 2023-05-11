'use strict';

import { EditAction } from './EditAction';
import { MarkupStamp } from '../MarkupStamp';
import { cloneStyle } from '../StyleUtils';

export { CreateStamp };

    /**
     * @constructor
     * 
     * @param editor 
     * @param id 
     * @param position 
     * @param size 
     * @param style 
     * @param {string} svg
     */

class CreateStamp extends EditAction {
    constructor(editor, id, position, size, rotation, style, svgData) {
        super(editor, 'CREATE-STAMP', id);
    
        this.selectOnExecution = false;
        this.position = {x: position.x, y: position.y};
        this.size = {x: size.x, y: size.y};
        this.rotation = rotation;
        this.style = cloneStyle(style);
        this.svgData = svgData;
    }

    redo() {
        const stamp = new MarkupStamp(this.targetId, this.editor, this.svgData);
    
        this.editor.addMarkup(stamp);
    
        stamp.setSize(this.position, this.size.x, this.size.y);
        stamp.setRotation(this.rotation);
        stamp.setStyle(this.style);
    }
    
    undo() {
        const markup = this.editor.getMarkup(this.targetId);
        this.editor.removeMarkup(markup);
    }
}

