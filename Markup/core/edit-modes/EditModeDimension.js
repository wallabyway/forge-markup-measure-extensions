'use strict';

import { EditMode } from './EditMode'
import { DeleteDimension } from '../edit-actions/DeleteDimension'
import { CreateDimension } from '../edit-actions/CreateDimension'
import { SetDimension } from '../edit-actions/SetDimension'
import { SetStyle } from '../edit-actions/SetStyle'
import * as MarkupTypes from '../MarkupTypes'
import * as MarkupEvents from '../MarkupEvents'
import { EditorTextInput } from './EditorTextInput'
import { measureTextLines, radiansToDegrees } from '../MarkupsCoreUtils'

    var MeasureCommon = Autodesk.Viewing.MeasureCommon;
    
    var MAX_LETTERS = 15;
    var SPACE = '\u00A0'; // Non-breaking space
    var _cursorPosition;

    /**
     *
     * @param editor
     * @constructor
     */
    export function EditModeDimension(editor) {

        var self = this;

        var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'font-size', 'font-family', 'font-style', 'font-weight'];
        EditMode.call(this, editor, MarkupTypes.MARKUP_TYPE_DIMENSION, styleAttributes);

        this.onHistoryChangeBinded = this.onHistoryChange.bind(this);

        this.measurement = new MeasureCommon.Measurement(MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE);
        var viewer = this.viewer;
        var measureExt = viewer.getExtension('Autodesk.Measure');
        
        function abortDimensionMarkup() {
            self.cancelEditModeChange = true;
            editor.enterEditMode(); // Selects default edit mode.
        }

        if (!measureExt) {
            console.error('Demension markup cant work without measure extension. Please load measure extension first');
            abortDimensionMarkup();
        }

        this.sharedMeasureConfig = measureExt.sharedMeasureConfig;
        
        // If PDF, force calibration
        if ((measureExt.forceCalibrate || viewer.model.getData().isLeaflet || viewer.model.getData().isPdf) && !measureExt.calibrationTool.isCalibrated()) {
            measureExt.openCalibrationRequiredDialog('dimension');
            abortDimensionMarkup();
        }
    }

    EditModeDimension.prototype = Object.create(EditMode.prototype);
    EditModeDimension.prototype.constructor = EditModeDimension;

    var proto = EditModeDimension.prototype;

    proto.deleteMarkup = function(markup, cantUndo) {

        markup = markup || this.selectedMarkup;
        if (markup && markup.type == this.type) {
            var deleteDimension = new DeleteDimension(this.editor, markup);
            deleteDimension.addToHistory = !cantUndo;
            deleteDimension.execute();
            this.creating = false;
            this.dragging = false;
            return true;
        }
        return false;
    };

    proto.updateTextBoxStyle = function(style) {
        if (this.isTextInputHelperActive()) {
            if (!style) {
                style = this.textInputHelper.textMarkup.getStyle();
            }

            this.textInputHelper.setStyle(style);
            this.updateTextBox(this.textInputHelper.textMarkup);
        }
    };

    proto.setStyle = function(style) {

        EditMode.prototype.setStyle.call(this, style);
        this.updateTextBoxStyle(style);

    };

    proto.notifyAllowNavigation = function(allows) {

        if (allows && this.isTextInputHelperActive()) {
            this.textInputHelper.acceptAndExit();
        }
    };

    proto.creationBegin = function() {
        EditMode.prototype.creationBegin.call(this);
    };

    proto.creationEnd = function() {

        this.dragging = false;
        EditMode.prototype.creationEnd.call(this);
    };

    proto.isMinSizeValid = function() {

        if (this.minSize !== 0) {
            var tmp = this.editor.sizeFromMarkupsToClient(this.selectedMarkup.size.x, this.selectedMarkup.size.y);
            return (tmp.x*tmp.x) >= (this.minSize * this.minSize);
        }

        return true;
    };

    proto.creationCancel = function() {

        EditMode.prototype.creationCancel.call(this);

        this.creating = false;
        this.dragging = false;

    };

    proto.destroy = function() {

        if (this.textInputHelper) {

            if (this.textInputHelper.isActive()) {
                this.textInputHelper.acceptAndExit();
            }

            this.editor.actionManager.removeEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);

            this.textInputHelper.destroy();
            this.textInputHelper = null;
        }

        this.updateViewportId();

        EditMode.prototype.destroy.call(this);
    };

    proto.getDistance = function() {

        var distance = null;

        this.measurement.computeResult(this.measurement.picks, this.viewer);

        if (this.viewer.model && this.measurement.distanceXYZ) {
            var d = Autodesk.Viewing.Private.convertUnits(this.viewer.model.getUnitString(), this.sharedMeasureConfig.units, this.sharedMeasureConfig.calibrationFactor, this.measurement.distanceXYZ);
            return Autodesk.Viewing.Private.formatValueWithUnits(d, this.sharedMeasureConfig.units, 3, this.sharedMeasureConfig.precision);
        }

        return distance;
    };

    proto.updateMeasurement = function(measurementNumber) {
        var editor = this.editor;

        var pick = this.measurement.getPick(measurementNumber);
        
        if (_cursorPosition) {
            pick.geomType = MeasureCommon.SnapType.SNAP_VERTEX;
            pick.geomVertex = _cursorPosition;
            pick.intersectPoint = _cursorPosition;
        } else {
            editor.snapper.copyResults(pick);
        }

        return pick;
    };

    proto.updateViewportId = function(viewportId) {
        if (this.viewer.model && this.viewer.model.is2d()) {
            if (!viewportId) {
                this.viewer.impl.updateViewportId(0);
                this.editor.snapper.setViewportId(null);
            }
            else {
                // Pass viewport Id to LineShader to make all other geometries with different viewport transparent
                this.viewer.impl.updateViewportId(viewportId);
                this.editor.snapper.setViewportId(viewportId);  
            
            }
        }
    };

    proto.pickFirstAnchor = function() {
        var editor = this.editor;
        this.measurement.clearAllPicks();
        var mousePosition = editor.getMousePosition();

        this.initialX = mousePosition.x;
        this.initialY = mousePosition.y;

        this.firstAnchor = editor.positionFromClientToMarkups(this.initialX, this.initialY);

        editor.beginActionGroup();

        var dimensionId = editor.getId();
        var create = new CreateDimension(editor, dimensionId, this.firstAnchor, null, this.currentText, this.style);
        create.execute();

        this.selectedMarkup = editor.getMarkup(dimensionId);
        this.creationBegin();
        
        var pick = this.updateMeasurement(1);
        this.updateViewportId(pick.viewportIndex2d);
    };

    proto.pickSecondAnchor = function(mouseDown) {

        var editor = this.editor;
        var selectedMarkup = this.selectedMarkup;

        this.secondAnchor = this.getFinalMouseDraggingPosition();

        this.updateMeasurement(2);

        // Correct Perpendicular
        if (MeasureCommon.correctPerpendicularPicks(this.measurement.getPick(1), this.measurement.getPick(2), this.viewer, editor.snapper)){
            var newPos = MeasureCommon.getSnapResultPosition(this.measurement.getPick(2), this.viewer);
            this.secondAnchor = editor.project(newPos);
            editor.snapper.indicator.render();
        }

        var secondAnchor = editor.positionFromClientToMarkups(this.secondAnchor.x, this.secondAnchor.y);

        this.size.x = selectedMarkup.size.x;
        this.size.y = selectedMarkup.size.y;

        selectedMarkup.currentText = this.getDistance();         

        var setDimension = new SetDimension(editor, selectedMarkup, this.firstAnchor, secondAnchor, selectedMarkup.currentText);
        setDimension.execute();

        var setStyle = new SetStyle(editor, selectedMarkup, this.style);
        setStyle.execute();

        // Open 'Add Length' textbox if no measurement has being taken.
        if (mouseDown && !selectedMarkup.currentText && this.isMinSizeValid()) {
            selectedMarkup.currentText = '';
            this.editor.selectMarkup(null);
            this.updateTextBox(selectedMarkup);
        } 
    };


    /**
     * Handler to mouse down events, used to start markups creation.
     * @private
     */
    proto.onMouseDown = function(event) {

        // Right click - do nothing.
        if (Autodesk.Viewing.Private.isRightClick(event, this.viewer.navigation)) {
            return;
        }

        _cursorPosition = null;

        // Textbox is open.
        if (this.isTextInputHelperActive()) {
            this.textInputHelper.acceptAndExit();
            return;
        }

        EditMode.prototype.onMouseDown.call(this);

        // User selected an already created markup.
        if (this.selectedMarkup && !this.creating) {
            return;
        }
        
        var isSnapped = this.editor.snapper.isSnapped();

        // Picked first point.
        if (!this.selectedMarkup && !this.creating && isSnapped) {
            this.pickFirstAnchor();
        }

        // Picked second point.
        else if (this.selectedMarkup && this.creating) {

            if (isSnapped) {
                this.pickSecondAnchor(true);   
            } else {
                this.deleteMarkup(this.selectedMarkup, true);
                this.creating = true;
            }

            this.updateViewportId();
            this.creationEnd();
        }
    };

    proto.onMouseUp = function(event) {

        if (this.dragging) {
            this.onMouseDown(event);   
            this.dragging = false; 
        }
    };


    /**
     * Handler to mouse move events, used to create markups.
     * @param {MouseEvent} event Mouse event.
     * @private
     */
    proto.onMouseMove = function(event) {

        _cursorPosition = null;

        if(!this.selectedMarkup || !this.creating) {
            return;
        }

        this.dragging = true;
        this.pickSecondAnchor(false);
    };

    proto.getFinalMouseDraggingPosition = function() {

        var editor = this.editor;
        var bounds = editor.getBounds();
        var mousePosition = editor.getMousePosition();

        if (!editor.snapper.isSnapped()) {
            if (editor.viewer.model && editor.viewer.model.is2d()) {
                _cursorPosition = MeasureCommon.inverseProject(mousePosition, editor.viewer);
            }
        }

        var initialX = this.initialX;
        var initialY = this.initialY;

        var finalX = Math.min(Math.max(bounds.x, mousePosition.x), bounds.x + bounds.width);
        var finalY = Math.min(Math.max(bounds.y, mousePosition.y), bounds.y + bounds.height);

        if (finalX == initialX &&
            finalY == initialY) {
            finalX++;
            finalY++;
        }

        // Make straight line when shift key is down.
        if (editor.input.constrainAxis && editor.viewer.model.is2d()) {
            var dx = Math.abs(finalX - initialX);
            var dy = Math.abs(finalY - initialY);

            if (dx > dy) {
                finalY = initialY;
            } 
            else {
                finalX = initialX;
            }

            editor.snapper.onMouseMove({ x:finalX, y:finalY });
            
            if (editor.snapper.isSnapped()) {
                editor.snapper.copyResults(this.measurement.getPick(2));
                _cursorPosition = null;
            } else {
                _cursorPosition = MeasureCommon.inverseProject({ x:finalX, y:finalY }, editor.viewer);
            }
        }

        return { x:finalX, y:finalY };
    };

    proto.isVisibleChar = function(keyCode) {

    return  ((keyCode > 47 && keyCode < 58)  || // number keys
            (keyCode == 32)                  || // spacebar
            (keyCode > 64 && keyCode < 91)   || // letter keys
            (keyCode > 95 && keyCode < 112)  || // numpad keys
            (keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
            (keyCode > 218 && keyCode < 223));   // [\]' (in order)
    };

    proto.measureTextLine = function(text, markup, editor) {

        text = text.replace(new RegExp(' ', 'g'), SPACE);
        text = text.length === 0 ? markup.initialText : text;
        return measureTextLines([text + '|'], this.style, editor)[0];

    };

    proto.handleKeyDown = function (e) {
        var textInputHelper = this.textInputHelper;
        
        if (e.keyCode === Autodesk.Viewing.KeyCode.ENTER) {
            return;
        }

        var markup = textInputHelper.textMarkup;
        var text = textInputHelper.textArea.value;

        if (e.keyCode === Autodesk.Viewing.KeyCode.BACKSPACE) {
            text = text.substring(0, text.length-1);
        }

        if (text.length < MAX_LETTERS && this.isVisibleChar(e.keyCode)) {
            text = text + e.key;            
        }

        var size = this.measureTextLine(text, markup, this.editor);
                
        this.updateTextBox(markup, size);
    };

    proto.updateTextBox = function(markup, size) {

        if (!this.textInputHelper) {
            this.textInputHelper = new EditorTextInput(this.viewer.container, this.editor, true, markup.initialText, MAX_LETTERS);
            this.textInputHelper.addEventListener(this.textInputHelper.EVENT_TEXT_CHANGE, this.onHelperTextChange.bind(this), false);
            this.handleKeyDownBinded = this.handleKeyDown.bind(this);
        }

        markup.text.style.display = 'none';
        
        if (!size) {
            size = this.measureTextLine(this.textInputHelper.textArea.value, markup, this.editor);
        }

        var transform = this.getTextAreaTransform(markup, size);

        this.textInputHelper.styleTextArea.setAttribute('text-align', 'center');
        
        this.textInputHelper.setActive(markup, false);

        
        // Override textArea attributes
        this.textInputHelper.textArea.style.position = 'static';
        this.textInputHelper.textArea.style.padding = '0';
        this.textInputHelper.textArea.style.width = size.width + 'px';
        this.textInputHelper.textArea.style.height = size.height + 'px';
        this.textInputHelper.textArea.style.transform = transform; // Maybe need to add 'allBrowsers' support

        this.editor.actionManager.removeEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
        this.editor.actionManager.addEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);    
        this.textInputHelper.textArea.removeEventListener('keydown', this.handleKeyDownBinded);
        this.textInputHelper.textArea.addEventListener('keydown', this.handleKeyDownBinded);    
        
    };

    proto.getTextAreaTransform = function(markup, size) {

        var position = markup.getClientPosition();
        var rotation = radiansToDegrees(markup.rotation) % 360;

        if (rotation > 90 && rotation <= 270 && markup.shouldFlip()) {
            rotation = 180 + rotation;
        }
    
        return [
            'translate(', (position.x - (size.width/2)) + 'px,',(position.y - this.viewer.container.clientHeight - size.height) + 'px)',
            'rotate(', rotation + 'deg)',
            'translate(0px,', size.height +'px)'
        ].join(' ');
    };

    proto.onMouseDoubleClick = function(markup) {

        if (markup === this.selectedMarkup) {
            this.editor.selectMarkup(null);
            this.updateTextBox(markup);
        }
    };

    proto.onHelperTextChange = function(event) {

        var dataBag = event.data;
        var markup = dataBag.markup;
        var textStyle = dataBag.style;
        var editor = this.editor;

        markup.text.style.display = 'block';

        if (dataBag.newText === '') {
            dataBag.newText = markup.initialText;
        }

        // When the text is created for the first time, an action group
        // is already created and it includes the CreateText action.
        // Thus, no need to begin another action group.
        if (!dataBag.firstEdit) {
            editor.beginActionGroup();
        }

        var setStyle = new SetStyle(editor, markup, textStyle);
        setStyle.execute();

        var setDimension = new SetDimension(editor, markup, markup.firstAnchor, markup.secondAnchor, dataBag.newText);
        setDimension.execute();

        editor.closeActionGroup();
        editor.selectMarkup(null);
    };

    /**
     * We want to make sure that the Input Helper gets removed from the screen
     * whenever the user attempts to perform an undo or redo action.
     * @param {Event} event
     * @private
     */
    proto.onHistoryChange = function(event) {
        if (this.isTextInputHelperActive()) {
            this.textInputHelper.textMarkup.text.style.display = 'block';
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
        if (this.isTextInputHelperActive()) {
            var editor = this.editor;
            editor.actionManager.removeEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
            var markup = this.textInputHelper.textMarkup;
            this.textInputHelper.acceptAndExit();
            markup.text.style.display = 'block';
        }
    };

    proto.useWithSnapping = function () {
        return true;
    };

