'use strict';

import { EditMode } from './EditMode';
import { DeleteText } from '../edit-actions/DeleteText';
import { DeleteCallout } from '../edit-actions/DeleteCallout';
import { CreateText } from '../edit-actions/CreateText';
import { SetText } from '../edit-actions/SetText';
import { SetSize } from '../edit-actions/SetSize';
import { SetStyle } from '../edit-actions/SetStyle';
import * as MarkupTypes from '../MarkupTypes';
import * as MarkupEvents from '../MarkupEvents';
import { EditorTextInput } from './EditorTextInput';


    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeText(editor) {

        var styleAttributes = [
            'font-size',
            'stroke-color',
            'stroke-opacity',
            'fill-color',
            'fill-opacity',
            'font-family',
            'font-style',
            'font-weight'
        ];
        EditMode.call(this, editor, MarkupTypes.MARKUP_TYPE_TEXT, styleAttributes);

        var helper = new EditorTextInput(this.viewer.container, this.editor, false, 'Text', 260);
        helper.addEventListener(helper.EVENT_TEXT_CHANGE, this.onHelperTextChange.bind(this), false);
        helper.addEventListener(helper.EVENT_TEXT_SET_ACTIVE, this.onHelperSetActive.bind(this), false);
        helper.addEventListener(helper.EVENT_TEXT_SET_INACTIVE, this.onHelperSetActive.bind(this), false);

        this.textInputHelper = helper;
        this.onHistoryChangeBinded = this.onHistoryChange.bind(this);
        this.minSize = 0; // No need to size it initially
        this.creationMethod = this.CREATION_METHOD_CLICK;
    }

    EditModeText.prototype = Object.create(EditMode.prototype);
    EditModeText.prototype.constructor = EditModeText;

    var proto = EditModeText.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var deleteText = new DeleteText(this.editor, markup);
            deleteText.addToHistory = !cantUndo;
            deleteText.execute();
            return true;
        }
        return false;
    };

    /**
     *
     * @param style
     */
    proto.setStyle = function(style) {

        if (this.textInputHelper && this.textInputHelper.isActive()) {

            this.textInputHelper.setStyle(style);
        } else {
            EditMode.prototype.setStyle.call(this, style);
        }
    };

    proto.notifyAllowNavigation = function(allows) {

        if (allows && this.textInputHelper && this.textInputHelper.isActive()) {
            this.textInputHelper.acceptAndExit();
        }
    };

    proto.destroy = function() {

        if (this.textInputHelper) {
            if (this.textInputHelper.isActive()) {
                this.textInputHelper.acceptAndExit();
            }
            this.textInputHelper.destroy();
            this.textInputHelper = null;
        }
        EditMode.prototype.destroy.call(this);
    };

    /**
     * Handler to mouse down events, used to start markups creation.
     */
    proto.onMouseDown = function() {

        if (this.textInputHelper && this.textInputHelper.isActive()) {
            this.textInputHelper.acceptAndExit();
            return;
        }

        if (this.selectedMarkup) {
            return;
        }

        var editor = this.editor;
        var mousePosition = editor.getMousePosition();
        var clientFontSize = editor.sizeFromMarkupsToClient(0, this.style['font-size']).y;
        var initialWidth = clientFontSize * 15; // Find better way to initialize size.
        var initialHeight = clientFontSize * 1;

        // Center position.
        var size = this.size = editor.sizeFromClientToMarkups(initialWidth, initialHeight);
        var position = editor.positionFromClientToMarkups(
            mousePosition.x + (initialWidth * 0.5),
            mousePosition.y + (initialHeight * 0.5));

        this.creationBegin();
        editor.beginActionGroup();

        // Given the initial width and font size, we assume that the text fits in one line.
        var createText = new CreateText(
            editor,
            editor.getId(),
            position,
            size,
            '',
            this.style);

        createText.execute();
        this.creationEnd();

        this.selectedMarkup = editor.getMarkup(createText.targetId);
        this.textInputHelper && this.textInputHelper.setActive(this.selectedMarkup, true);
        this.editor.actionManager.addEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
    };

    proto.updateTextBoxStyle = function() {
        if (this.isTextInputHelperActive()) {
            this.textInputHelper.onCameraChanged();
        }
    };

    proto.onMouseUp = function(event) {

    };

    proto.onMouseDoubleClick = function(markup) {

        if (markup === this.selectedMarkup) {
            this.editor.selectMarkup(markup);
            this.editor.editFrame.setMarkup(markup);
            this.textInputHelper && this.textInputHelper.setActive(markup, false);
        }
    };

    proto.onHelperSetActive = function(event) {
        var databag = event.data;
        var markup = databag.markup;
        if (markup) {
            markup.setIsHelperTextActive(databag.isActive);
            markup.setIsShapeVisible(!databag.isActive);
        }
    };

    proto.onHelperTextChange = function(event) {

        var dataBag = event.data;
        var textMarkup = dataBag.markup;
        var textStyle = dataBag.style;
        var curSelection = this.selectedMarkup;

        this.editor.actionManager.removeEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);

        // Deal with edge case first: Creating a Label without text
        if (dataBag.newText === '') {
            this.editor.cancelActionGroup();

            var deleteCallout = new DeleteCallout(this.editor, textMarkup);
            deleteCallout.execute();

            if (textMarkup !== curSelection) {
                this.editor.selectMarkup(curSelection);
            }

            return;
        }

        // When the text is created for the first time, an action group
        // is already created and it includes the CreateText action.
        // Thus, no need to begin another action group.
        if (!dataBag.firstEdit) {
            this.editor.beginActionGroup();
        }

        // Size change action //
        var position = this.editor.positionFromClientToMarkups(
            dataBag.newPos.x, dataBag.newPos.y
        );
        var size = this.editor.sizeFromClientToMarkups(
            dataBag.width, dataBag.height
        );
        var setSize = new SetSize(
            this.editor,
            textMarkup,
            position,
            size.x,
            size.y);
        setSize.execute();

        // Text change action //
        var setText = new SetText(
            this.editor,
            textMarkup,
            textMarkup.position,
            textMarkup.size,
            dataBag.newText);
        setText.execute();

        var setStyle = new SetStyle(
            this.editor,
            textMarkup,
            textStyle
        );
        setStyle.execute();

        // However, we do need to close the action group at this point. For both cases.
        this.editor.closeActionGroup();
        this.editor.selectMarkup(curSelection);
    };

    /**
     * We want to make sure that the Input Helper gets removed from the screen
     * whenever the user attempts to perform an undo or redo action.
     * @param {Event} event
     * @private
     */
    proto.onHistoryChange = function(event) {

        if (this.textInputHelper && this.textInputHelper.isActive()) {
            this.editor.actionManager.removeEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
            this.textInputHelper.setInactive();
        }
    };

    /**
     * Notify the markup that the displayed markups are being saved so edit mode can finish current editions.
     */
    proto.onSave = function() {

        EditMode.prototype.onSave.call(this);

        // Close input helper if it's open.
        if (this.textInputHelper && this.textInputHelper.isActive()) {
            var firstEdit = this.textInputHelper.firstEdit;

            this.editor.actionManager.removeEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
            this.textInputHelper.setInactive();

            // Close action group if open (first edit).s
            if (firstEdit) {
                this.editor.cancelActionGroup();
            }

            this.editor.selectMarkup(null);
            this.selectedMarkup = null;
        }
    };

    proto.updateTextBoxStyle = function() {
        if (this.isTextInputHelperActive()) {
            this.textInputHelper.onCameraChanged();
        }
    };

