'use strict';

import { EditAction } from './EditAction';
import { CreateStamp } from './CreateStamp';

export { DeleteStamp };

class DeleteStamp extends EditAction {
     constructor(editor, stamp) { 
        super(editor, 'DELETE-STAMP', stamp.id);

        this.createStamp = new CreateStamp(
            editor,
            stamp.id,
            stamp.position,
            stamp.size,
            stamp.rotation,
            stamp.getStyle()
        );
    }

    redo() {
        this.createStamp.undo();
    }

    undo() {
        this.createStamp.redo();
    }
}