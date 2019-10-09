'use strict';

    /**
     * Fired whenever the drawing tool changes. For example, when the Arrow drawing
     * tool changes into the Rectangle drawing tool.
     * See {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#changeEditMode|MarkupsCore.changeEditMode()}
     * for a list of all supported drawing tools (EditModes).
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_EDITMODE_CHANGED
     * @type {string}
     */
    export const EVENT_EDITMODE_CHANGED = "EVENT_EDITMODE_CHANGED";

    /**
     * Fired when Edit mode has been enabled, which allows the end user to start
     * drawing markups over the Viewer canvas.
     * See also {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|MarkupsCore.enterEditMode()}.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_EDITMODE_ENTER
     * @type {string}
     */
    export const EVENT_EDITMODE_ENTER = "EVENT_EDITMODE_ENTER";

    /**
     * Fired when Edit mode has been disabled, preventing the end user from
     * drawing markups over the Viewer canvas.
     * See also {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#leaveEditMode|MarkupsCore.leaveEditMode()}.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_EDITMODE_LEAVE
     * @type {string}
     */
    export const EVENT_EDITMODE_LEAVE = "EVENT_EDITMODE_LEAVE";

    /**
     * Fired when a drawn markup has been selected by the end user with a click command.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_MARKUP_SELECTED
     * @type {string}
     */
    export const EVENT_MARKUP_SELECTED = "EVENT_MARKUP_SELECTED";

    /**
     * Fired when a drawn markup is being dragged over the Viewer canvas.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_MARKUP_DRAGGING
     * @type {string}
     */
    export const EVENT_MARKUP_DRAGGING = "EVENT_MARKUP_DRAGGING";

    /**
     * Internal usage only.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_MARKUP_ENTER_EDITION
     * @type {string}
     * @private
     */
    export const EVENT_MARKUP_ENTER_EDITION = "EVENT_MARKUP_ENTER_EDITION";

    /**
     * Internal usage only.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_MARKUP_CANCEL_EDITION
     * @type {string}
     * @private
     */
    export const EVENT_MARKUP_CANCEL_EDITION = "EVENT_MARKUP_CANCEL_EDITION";

    /**
     * Internal usage only.
     * 
     * @event Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#EVENT_MARKUP_DELETE_EDITION
     * @type {string}
     * @private
     */
    export const EVENT_MARKUP_DELETE_EDITION = "EVENT_MARKUP_DELETE_EDITION";


    /**
     * Fired whenever a new undo or redo action is available.
     */
    export const EVENT_HISTORY_CHANGED = "EVENT_HISTORY_CHANGED";

    /**
     * Fired when a markup creation begins. 
     * For example, as soon as the user starts dragging with the mouse
     * to draw an arrow on the screen.
     */
    export const EVENT_EDITMODE_CREATION_BEGIN = "EVENT_EDITMODE_CREATION_BEGIN";

    /**
     * Fired when a markup has been created.
     * For example, as soon as the user stops dragging and releases the
     * mouse button to finish drawing an arrow on the screen
     */
    export const EVENT_EDITMODE_CREATION_END = "EVENT_EDITMODE_CREATION_END";

    /**
     * Fired when a markup is no longer selected.
     */
    export const EVENT_MARKUP_DESELECT = "EVENT_MARKUP_DESELECT";

    /**
     * The selected markup is being modified
     */
    export const EVENT_EDITFRAME_EDITION_START = "EVENT_EDITFRAME_EDITION_START";

    /**
     * The selected markup is no longer being modified
     */
    export const EVENT_EDITFRAME_EDITION_END = "EVENT_EDITFRAME_EDITION_END";