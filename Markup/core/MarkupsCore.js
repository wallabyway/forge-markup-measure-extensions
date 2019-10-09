'use strict';

import { EditActionManager } from './edit-actions/EditActionManager'
import * as MarkupEvents from './MarkupEvents'
import * as MarkupTypes from './MarkupTypes'
import { addTraitEventDispatcher, createSvgElement, setSvgParentAttributes,
    MARKUP_DEFAULT_STROKE_WIDTH_IN_PIXELS, MARKUP_DEFAULT_FONT_WIDTH_IN_PIXELS,
    hideLmvUi, restoreLmvUi, dismissLmvHudMessage, 
    removeAllMetadata, transferChildNodes, addSvgMetadata,
    svgNodeToString, checkPolygon, stringToSvgNode, createMarkupFromSVG,
    worldToClient, clientToWorld } from './MarkupsCoreUtils'
import { cloneStyle, copyStyle, createStyle } from './StyleUtils'
import { DomElementStyle } from './DomElementStyle'
import { Clipboard } from './edit-clipboard/Clipboard'
import { InputHandler } from './edit-input/InputHandler'
import { EditFrame } from './EditFrame'
import { MarkupTool } from './MarkupTool'
import { EditModeArrow } from './edit-modes/EditModeArrow'

import * as Blah from './edit-modes/BuiltinEditModes' // IMPORTANT!!
import CSS from './Markups.css' // IMPORTANT!!


    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    var PERSPECTIVE_MODE_SCALE = 1000;

    /**
     * Extension that allows end users to draw 2D markups on top of 2D and 3D models.
     *
     * @tutorial feature_markup
     * @param {Autodesk.Viewing.Viewer3D} viewer - Viewer instance used to operate on.
     * @param {object} options - Same Dictionary object passed into {@link Autodesk.Viewing.Viewer3D|Viewer3D}'s constructor.
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#show|show()}.
     * @param {boolean} [options.markupDisableHotkeys] - Disables hotkeys for copy, cut, paste, duplicate, undo, redo and deselect.
     * @param {Autodesk.Viewing.ToolInterface} [options.markupToolClass] - Class override for input handling.
     * Use it to override/extend default hotkeys and/or mouse/gesture input.
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     * @constructor
     */
    export function MarkupsCore(viewer, options) {

        Autodesk.Viewing.Extension.call(this, viewer, options);

        this.options = this.options || {};
        this.markups = [];
        this.styles = {};

        this.activeLayer = '';
        this.duringViewMode = false;
        this.duringEditMode = false;

        this.svgLayersMap = {};

        // Add action manager.
        this.actionManager = new EditActionManager( 50 ); // history of 50 actions.
        this.actionManager.addEventListener(MarkupEvents.EVENT_HISTORY_CHANGED, this.onEditActionHistoryChanged.bind(this));

        this.nextId = 0; // Used to identify markups by id during an edit session.

        // Clipboard.
        this.clipboard = new Clipboard(this);

        // Default Input handler.
        this.input = new InputHandler();
        this.input.setGlobalManager(this.globalManager);

        // Bind functions so they have access to globalManager
        this.createSvgElement = createSvgElement.bind(this);
        this.addSvgMetadata = addSvgMetadata.bind(this);
        this.checkPolygon = checkPolygon.bind(this);

        // Extension will dispatch events.
        addTraitEventDispatcher(this);

        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, function() {
            this.getStrokeWidth();
            this.getFontWidth();
        }.bind(this), { once: true });

        // Handled events.
        this.onCameraChangeBinded = this.onCameraChange.bind(this);
        this.onViewerResizeBinded = function(event) {
            // This is ugly, but we need to do this twice
            var self = this;
            // First usage is to avoid a blinking scenario
            self.onViewerResize(event);
            requestAnimationFrame(function(){
                // Second one is to actually make it work on some resize scenarios.
                // Check the unlikely scenario that we are no longer in view mode.
                if (self.duringViewMode) {
                    self.onViewerResize(event);
                }
            });
        }.bind(this);

        this.onMarkupSelectedBinded = this.onMarkupSelected.bind(this);
        this.onMarkupEnterEditionBinded = this.onMarkupEnterEdition.bind(this);
        this.onMarkupCancelEditionBinded = this.onMarkupCancelEdition.bind(this);
        this.onMarkupDeleteEditionBinded = this.onMarkupDeleteEdition.bind(this);
        this.onToolChangeBinded = this.onToolChange.bind(this);
        this.onUnitsCalibrationStartsBinded = this.onUnitsCalibrationStarts.bind(this);

        viewer.addEventListener(MeasureCommon.Events.UNITS_CALIBRATION_STARTS_EVENT, this.onUnitsCalibrationStartsBinded);
    }

    MarkupsCore.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
    MarkupsCore.prototype.constructor = MarkupsCore;

    var proto = MarkupsCore.prototype;

    proto.load = async function () {

        // Add layer where annotations will actually live
        var svg = this.svg = this.createSvgElement('svg');
        setSvgParentAttributes(svg);

        // NOTE: Required since LMV renders Y coordinates upwards,
        // while browser's Y coordinates goes downwards.
        var svgStyle = new DomElementStyle();
        svgStyle.setAttribute('position', 'absolute');
        svgStyle.setAttribute('left', '0');
        svgStyle.setAttribute('top', '0');
        svgStyle.setAttribute('transform', 'scale(1,-1)', { allBrowsers: true});
        svgStyle.setAttribute('transformOrigin', '0, 0', { allBrowsers: true});
        svg.setAttribute('style', svgStyle.getStyleString());

        this.bounds = {x:0, y:0, width:0, height:0};

        this.input.attachTo(this);

        //Instantiate edit frame.
        this.editFrame = new EditFrame(this.viewer.container, this);
        this.editFrame.addEventListener(MarkupEvents.EVENT_EDITFRAME_EDITION_START, function(){this.disableMarkupInteractions(true);}.bind(this));
        this.editFrame.addEventListener(MarkupEvents.EVENT_EDITFRAME_EDITION_END, function(){this.disableMarkupInteractions(false);}.bind(this));

        // Register tool
        var toolClass = this.options.markupToolClass || MarkupTool;
        this.changeMarkupTool(toolClass, !this.options.markupDisableHotkeys);

        await this.viewer.loadExtension('Autodesk.Snapping');

        this.snapper = new Autodesk.Viewing.Extensions.Snapping.Snapper(this.viewer, {markupMode:true});
        this.viewer.toolController.registerTool(this.snapper);

        return true;
    };

    /**
     * Change the markup tool's class in order to implement a different behaviour to the UI.
     * @param {Autodesk.Viewing.Extensions.Markups.Core.MarkupTool} toolClass - Implementation or extension of MarkupTool's class.
     * @param {boolean} enableHotKeys - Whether to enable markup's hot-keys or not.
     */
    proto.changeMarkupTool = function(toolClass, enableHotKeys) {
        if (this.markupTool) {
            this.viewer.toolController.deregisterTool(this.markupTool);
            this.markupTool = null;
        }

        this.markupTool = new toolClass();
        this.markupTool.setCoreExtension(this);
        this.markupTool.setHotkeysEnabled(enableHotKeys);
        this.viewer.toolController.registerTool(this.markupTool);
    };

    proto.unload = function() {

        this.hide();

        this.input.detachFrom(this);

        this.editFrame.unload();

        if (this.markupTool) {
            this.viewer.toolController.deregisterTool(this.markupTool);
            this.markupTool = null;
        }

        if (this.snapper) {
            this.viewer.toolController.deregisterTool(this.snapper);
            this.snapper = null;
        }

        var svg = this.svg;
        if (svg && this.onMouseDownBinded) {
            svg.removeEventListener("mousedown", this.onMouseDownBinded);
            this.onMouseDownBinded = null;
        }
        if (svg.parentNode) {
            svg.parentNode.removeChild(svg);
        }
        this.editModeSvgLayerNode = null;
        this.svg = null;

        return true;
    };

    MarkupsCore.prototype.getStrokeWidth = function() {
        
        if (!this.initialStrokeWidth || (this.viewer.model && !this.viewer.model.is2d())) {
            this.initialStrokeWidth = this.sizeFromClientToMarkups(0, MARKUP_DEFAULT_STROKE_WIDTH_IN_PIXELS).y;
        }

        return this.initialStrokeWidth;
    };

    MarkupsCore.prototype.getFontWidth = function() {
        
        if (!this.initialFontWidth || (this.viewer.model && !this.viewer.model.is2d())) {
            this.initialFontWidth = this.sizeFromClientToMarkups(0, MARKUP_DEFAULT_FONT_WIDTH_IN_PIXELS).y;
        }

        return this.initialFontWidth;
    };

    /**
     * Toggle in and out of Edit mode. In Edit mode the user is able to draw markups on the canvas.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|enterEditMode()} and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#leaveEditMode|leaveEditMode()}
     */
    MarkupsCore.prototype.toggleEditMode = function() {

        if (this.duringEditMode) {
            this.leaveEditMode();
        } else {
            this.enterEditMode();
        }
    };

    /**
     * Enables mouse interactions and mobile device gestures over the Viewer canvas to create or draw markups.
     *
     * Exit Edit mode by calling {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#leaveEditMode|leaveEditMode()}.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#show|show()}
     * @param {string} layerId - [optional] Identifier for the layer of markups to be edited. Example "Layer1".
     * @returns {boolean} Returns true if editMode is active
     */
    MarkupsCore.prototype.enterEditMode = function(layerId) {

        function disableLayerMarkups(layer, disable){
            if (layer){
                var layerMarkups = layer.markups;
                for (var k = 0; k < layerMarkups.length; k++){
                    var m = layerMarkups[k];
                    m.disableInteractions(disable);
                }
            }
        }
        if (layerId) {
            if (!this.svgLayersMap[layerId]) {
                // if layerId is supplied but it does not exist in the svgLayerMap then create the new layer
                console.warn("No such layer exists.");
                return false;
            }
        }

        // If not currently shown, then show
        if (!this.duringViewMode) {
            if (!this.show()){
                return false; // Failed to enter view mode.
            }
        }

        // Initialize the edit mode layer if it does not exist
        if(!this.editModeSvgLayerNode) {
            var parSvg = this.createSvgElement('g');
            this.editModeSvgLayerNode = {
                markups: [],
                svg: parSvg
            };
            this.editModeSvgLayerNode.svg.setAttribute('cursor', 'default');
        }


        if ((this.editModeSvgLayerNode.svg.parentNode != this.svg) || !layerId) {
            this.svg.appendChild(this.editModeSvgLayerNode.svg);
        }
        this.svg.setAttribute('cursor', 'crosshair');


        if (layerId) {
            var layer = this.svgLayersMap[layerId];
            // If the layer exists in the layer map, use the information stored for that specific layer.
            if (layer) {
                // Remove the edit layer when entering edit mode of a specific edit mode.
                var editModeLayerParentNode = this.editModeSvgLayerNode.svg.parentNode;
                editModeLayerParentNode && editModeLayerParentNode.removeChild(this.editModeSvgLayerNode.svg);

                // disable the markups in the editModeLayer
                disableLayerMarkups(this.editModeSvgLayerNode, true);

                // Enable interactions for markups in the current edit layer and disable interactions for markups in
                // the other layers.
                for (var key in this.svgLayersMap){
                    var markups = this.svgLayersMap[key].markups;
                    for (var i = 0; i < markups.length; i++) {
                        var markup = markups[i];
                        if (key !== layerId.toString()){
                            // disable all not in the current layer.
                            markup.disableInteractions(true);
                        } else {
                            // enable all markups in current layer.
                            markup.disableInteractions(false);
                        }
                    }
                }

                // assign the current layer to the global active layer
                this.activeLayer = layerId;
                this.editingLayer = layerId;
                var svgParent = layer.svg;

                // remove previous svg layer child from svg
                svgParent.parentNode && this.svg.removeChild(svgParent);

                // reassign the markups in that layer to the global markups list
                this.markups = layer.markups.slice();

                // re-append svg layer child to svg to make it the top most layer
                this.svg.appendChild(svgParent);
            }
        } else {
            // disable interactions for the previous markups
            // Example: enterEditMode(layer) -> enterEditMode()
            if (this.editingLayer) {
                for (var k = 0; k < this.markups.length; k++) {
                    var m = this.markups[k];
                    m.disableInteractions(true);
                }
                disableLayerMarkups(this.editModeSvgLayerNode, false);
            }
            this.editingLayer = '';
            if (!this.editModeSvgLayerNode) {
                this.markups = [];
            }else{
                this.markups = this.editModeSvgLayerNode.markups.slice();
            }
            this.activeLayer = '';
        }

        this.input.enterEditMode();
        this.activateTool(true);
        this.styles = {}; // Clear EditMode styles.
        this.defaultStyle = null;
        this.duringEditMode = true;
        this.changeEditMode(new EditModeArrow(this));
        this.actionManager.clear();
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITMODE_ENTER });
        this.allowNavigation(false);
        return true;
    };

    /**
     * Exits Edit mode.
     *
     * See also {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|enterEditMode()}.
     *
     * @returns {boolean} Returns true if Edit mode has been deactivated
     */
    MarkupsCore.prototype.leaveEditMode = function() {

        var NOT_IN_EDIT_MODE = true;
        var WE_ARE_STILL_IN_EDIT_MODE = false;

        if (!this.duringEditMode || !this.duringViewMode) {
            return NOT_IN_EDIT_MODE;
        }

        var viewer = this.viewer;
        if (!viewer) {
            return WE_ARE_STILL_IN_EDIT_MODE; // something is very wrong...
        }

        this.editMode.destroy();
        this.editMode = null;
        this.duringEditMode = false;

        if (this.snapper) {
            this.snapper.indicator.clearOverlays();
            this.snapper.clearSnapped();
        }

        // Remove the edit layer
        if (this.editModeSvgLayerNode && this.editModeSvgLayerNode.svg.parentNode){
            this.svg.removeChild(this.editModeSvgLayerNode.svg);
        }
        this.svg.setAttribute('cursor', 'default');

        this.input.leaveEditMode();
        this.editFrame.setMarkup(null);
        this.activateTool(true);

        this.allowNavigation(true);
        this.dispatchEvent({ type: MarkupEvents.EVENT_EDITMODE_LEAVE });
        return NOT_IN_EDIT_MODE;
    };

    /**
     * Toggle between visible markups, i.e., show() and hidden markups, i.e., hide().
     */
    MarkupsCore.prototype.toggle = function() {

        if (this.duringViewMode) {
            this.hide();
        } else {
            this.show();
        }
    };

    /**
     * Enables loading of previously saved markups.
     * Exit Edit mode by calling {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hide|hide()}.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|enterEditMode()}.
     * @returns {boolean} Whether it successfully entered view mode or not.
     */
    MarkupsCore.prototype.show = function() {

        var viewer = this.viewer;
        if (!viewer || !viewer.model || !this.svg) {
            return false;
        }

        // Return if already showing or in edit-mode.
        // Notice that edit mode requires that we are currently show()-ing.
        if (this.duringViewMode || this.duringEditMode) {
            return true;
        }

        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        viewer.addEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, this.onViewerResizeBinded);

        // Add parent svg of all markups.
        viewer.container.appendChild(this.svg);
        viewer.reorderElements(this.svg);

        this.input.enterViewMode();
        hideLmvUi(viewer);

        // TODO: Nasty hack, currently there is no API to disable mouse highlighting in 3d models.
        // TODO: We nuke rollover function in viewer, for now, public api will be added soon.
        this.onViewerRolloverObject = viewer.impl.rolloverObject;
        viewer.impl.rolloverObject = function(){};

        this.activateTool(true);
        var camera = viewer.impl.camera;
        this.onViewerResize({ width: camera.clientWidth, height: camera.clientHeight });

        // See function loadMarkups() for when the actual SVG gets added onstage //
        this.svgLayersMap = {};
        this.duringViewMode = true;
        this.allowNavigation(true);
        return true;
    };

    /**
     * Removes any markup currently overlaid on the viewer. It exits Edit mode if it is active.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#show|show()}
     * @returns {boolean} Whether it successfully left view mode or not.
     */
    MarkupsCore.prototype.hide = function() {

        var RESULT_HIDE_OK = true;
        var RESULT_HIDE_FAIL = false;

        var viewer = this.viewer;
        if (!viewer || !this.duringViewMode) {
            return RESULT_HIDE_OK;
        }

        if (this.duringEditMode) {
            if (!this.leaveEditMode()) {
                return RESULT_HIDE_FAIL;
            }
        }

        viewer.removeEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        viewer.removeEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, this.onViewerResizeBinded);

        var svg = this.svg;
        svg.parentNode && svg.parentNode.removeChild(svg);

        // Remove all Markups and metadata (if any)
        this.unloadMarkupsAllLayers();
        removeAllMetadata(svg);

        this.input.leaveViewMode();
        restoreLmvUi(viewer);
        this.viewer.impl.rolloverObject = this.onViewerRolloverObject;

        this.activateTool(false);
        this.duringViewMode = false;
        return RESULT_HIDE_OK;
    };

    /**
     * Removes newly created markups in the current editing layer.
     * Markups that were created in a specific layer will not be removed.
     *
     * Markups should have been added while in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|Edit mode}.
     */
    MarkupsCore.prototype.clear = function() {
        // Can only clear specific layers when in the edit mode of that layer.
        if (!this.duringEditMode) {
            console.warn("Clear only removes markups when in Edit Mode.");
            return;
        }
        var editModeLayer = this.editingLayer ? this.svgLayersMap[this.editingLayer] : this.editModeSvgLayerNode;
        if (editModeLayer) {
            var markups = editModeLayer.markups;
            var svg = editModeLayer.svg;
            if (svg && svg.childNodes.length > 0) {
                while (svg.childNodes.length) {
                    svg.removeChild(svg.childNodes[0]);
                }
            }
            while (markups.length > 0) {
                var markup = markups[0];
                this.removeMarkup(markup);
                markup.destroy();
            }
        }
    };

    /**
     * Returns an SVG string with the markups created so far.
     * The SVG string can be reloaded using
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#loadMarkups|loadMarkups()}.
     *
     * Markups should have been added while in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|Edit mode}.
     * @returns {string} Returns an SVG element with all of the created markups in a string format.
     */
    MarkupsCore.prototype.generateData = function() {

        var defaultLayer = this.editModeSvgLayerNode.svg;

        if (this.editMode) {
            this.editMode.onSave();
        }

        // Sanity check, remove any lingering metadata nodes
        removeAllMetadata(this.svg);

        if (this.activeLayer){
            defaultLayer = this.svgLayersMap[this.activeLayer].svg;
        }

        var tmpNode = this.createSvgElement("svg");
        transferChildNodes(this.svg, tmpNode); // Transfer includes this.editModeSvgLayerNode
        transferChildNodes(defaultLayer, this.svg);

        // version 1: first implementation.
        // version 2: added global offset to markup positions.
        // version 3: change node structure to include hitareas, hit areas are not exported.
        // version 4: scale perspective markups space by PERSPECTIVE_MODE_SCALE because bug in firefox. LMV-1150
        var metadataObject = {
            "data-model-version": "4"
        };
        var metadataNode = this.addSvgMetadata(this.svg, metadataObject);
        var metadataNodes = [ metadataNode ];

        // Notify each markup to inject metadata
        this.markups.forEach(function(markup){
            var addedNode = markup.setMetadata();
            if (addedNode) {
                metadataNodes.push(addedNode);
            }
        });

        // Generate the data!
        var data = svgNodeToString(this.svg);

        // Remove metadataObject before returning
        metadataNodes.forEach(function(metadataNode){
            metadataNode.parentNode.removeChild(metadataNode);
        });

        transferChildNodes(this.svg, defaultLayer);
        transferChildNodes(tmpNode, this.svg);
        tmpNode = null; // get rid of it.

        return  data;
    };

    /**
     * @private
     */
    MarkupsCore.prototype.generatePoints3d = function() {

        var result = {markups: [], main: null};
        var markups = this.markups;
        var markupsCount = markups.length;

        if (markupsCount === 0) {
            return result;
        }

        // Gather a 3d point for markup.
        var idTarget = this.viewer.impl.renderer().readbackTargetId();
        for(var i = 0; i < markupsCount; ++i) {

            var markup = markups[i];
            var point = markup.generatePoint3d(idTarget) || null;
            result.markups.push(
                {
                    id: markup.id,
                    type: markup.type,
                    point: point || null
                });
        }


        // If there is 3d point associated with an arrow, we use that as main point.
        if (markupsCount === 1) {

            var main = result.markups[0].point;
            result.main = main && main.clone();
            return result;
        }

        for(var i = 0; i < markupsCount; ++i) {

            var collision = result.markups[i];
            if (collision.type === MarkupTypes.MARKUP_TYPE_ARROW && collision.point !== null) {

                result.main = collision.point.clone();
                return result;
            }
        }

        // If there is no arrows, we average bounding boxes and get a 3d point inside it.
        var bbX0 = Number.POSITIVE_INFINITY;
        var bbY0 = Number.POSITIVE_INFINITY;
        var bbX1 = Number.NEGATIVE_INFINITY;
        var bbY1 = Number.NEGATIVE_INFINITY;

        for(var i = 0; i < markupsCount; ++i) {

            var boundingBox = markups[i].generateBoundingBox();

            bbX0 = Math.min(bbX0, boundingBox.min.x);
            bbY0 = Math.min(bbY0, boundingBox.min.y);
            bbX1 = Math.max(bbX1, boundingBox.max.x);
            bbY1 = Math.max(bbY1, boundingBox.max.y);
        }

        var polygon = {};

        polygon.vertexCount = 4;
        polygon.xVertices = new Float32Array([bbX0, bbX1, bbX1, bbX0]);
        polygon.yVertices = new Float32Array([bbY0, bbY0, bbY1, bbY1]);

        var point2d = this.checkPolygon(polygon, idTarget);
        var point3d = point2d && this.viewer.clientToWorld(point2d.x, point2d.y);
        result.main = point3d && point3d.point;

        return result;
    };

    /**
     * Renders the markups onto a 2D canvas context to generate an image.
     * @param {CanvasRenderingContext2D} context - Markups are drawn using the context provided
     */
    MarkupsCore.prototype.renderToCanvas = function(context, callback, renderAllMarkups) {

        var width = this.bounds.width;
        var height = this.bounds.height;
        var viewBox = this.getSvgViewBox(width, height);
        var numberOfScreenshotsTaken = 0;
        var markups = [];
        var layer;

        var onMarkupScreenshotTaken = function () {
            if (callback && (++numberOfScreenshotsTaken === markups.length)) {
                callback();
            }
        }.bind(this);

        if (renderAllMarkups) {
            var svgKeys = Object.keys(this.svg.childNodes);
            var layersKeys = Object.keys(this.svgLayersMap);

            // Append only markups that their parent layer is contained inside the svg main container.
            for (var i = 0; i < svgKeys.length; i++) {                
                for (var j = 0; j < layersKeys.length; j++) {
                    layer = this.svgLayersMap[layersKeys[j]];
                    if (this.svg.childNodes[svgKeys[i]] === layer.svg) {
                        markups = markups.concat(layer.markups);
                    }
                }
            }
        } else {
            layer = this.svgLayersMap[this.activeLayer] || this.editModeSvgLayerNode;
            markups = layer.markups;
        }

        if (markups.length === 0) {
            callback();
        } else {
            markups.forEach(function(markup) {
                markup.renderToCanvas(context, viewBox, width, height, onMarkupScreenshotTaken);
            });
        }
    };

    /**
     * Changes the active drawing tool. For example, from the Arrow drawing tool to the Rectangle drawing tool.
     * Only applicable while in {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|Edit mode}.
     *
     * Supported values are:
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModeArrow(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModeRectangle(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModeCircle(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModeCloud(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModeText(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModeFreehand(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModePolyline(MarkupsCoreInstance)`
     * - `new Autodesk.Viewing.Extensions.Markups.Core.EditModePolycloud(MarkupsCoreInstance)`
     *
     * This function fires event `Autodesk.Viewing.Extensions.Markups.Core.EVENT_EDITMODE_CHANGED`.
     * @param {Object} editMode - Object instance for the drawing tool
     */
    MarkupsCore.prototype.changeEditMode = function(editMode) {

        var oldEditMode = this.editMode;
        oldEditMode && oldEditMode.destroy();

        editMode.addEventListener(MarkupEvents.EVENT_EDITMODE_CREATION_BEGIN, function() {this.disableMarkupInteractions(true);}.bind(this));
        editMode.addEventListener(MarkupEvents.EVENT_EDITMODE_CREATION_END, function(){this.disableMarkupInteractions(false);}.bind(this));
        editMode.addEventListener(MarkupEvents.EVENT_MARKUP_DESELECT, function(event){this.dispatchEvent(event);}.bind(this));

        this.editMode = editMode;
        this.styles[editMode.type] = cloneStyle(editMode.getStyle());

        this.dispatchEvent({type:MarkupEvents.EVENT_EDITMODE_CHANGED, target: editMode});
    };

    /**
     * Check whether a user can perform camera navigation operations on the current loaded model.
     * While the extension is active, the user can still draw markups.
     * Panning and zooming are only supported for orthographic cameras.
     *
     * @return {boolean} Whether {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#allowNavigation|allowNavigation()} can succeed.
     */
    MarkupsCore.prototype.isNavigationAllowed = function() {

        return !this.viewer.impl.camera.isPerspective;
    };

    /**
     * Enables click, tap, and swipe behavior to allow camera zoom and panning operations. It is only available in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|Edit mode}.
     *
     * @param {boolean} allow - Whether camera navigation interactions are active or not.
     */
    MarkupsCore.prototype.allowNavigation = function(allow) {

        //we will still need to update the markup styles even if in perspective mode
        var editMode = this.editMode;
        this.navigating = allow;

        if (allow){
            this.svg.setAttribute("pointer-events", "none");
            editMode && this.selectMarkup(null);
        } else {
            this.svg.setAttribute("pointer-events", "painted");
        }

        // Update pointer events for all markups.
        var markups = this.markups;
        var markupsCount = markups.length;

        for(var i = 0; i < markupsCount; ++i) {
            markups[i].updateStyle();
        }
        editMode && editMode.notifyAllowNavigation(allow);

        // Navigation is not allowed while in perspective mode.
        if (allow && (this.duringEditMode || this.duringViewMode) && !this.isNavigationAllowed()) {
            return false;
        }

        // Clear snapper.
        if (allow && this.snapper) {
            this.snapper.indicator.clearOverlays();
            this.snapper.clearSnapped();
        }

        this.markupTool.allowNavigation(allow);

    };

    /**
     * Sets mouse interactions and mobile device gestures with markups. Only applicable in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|Edit mode}.
     * @param {boolean} disable - true to disable interactions with markups; false to enable interactions with markups; default false.
     */
    MarkupsCore.prototype.disableMarkupInteractions = function(disable) {

        if (this.editModeSvgLayerNode) {
            this.editModeSvgLayerNode.svg.setAttribute('cursor', disable ? 'inherit' : 'default');
        }
        this.markups.forEach(function(markup) {markup.disableInteractions(disable);});
    };

    /**
     *
     * @param isActive
     * @private
     */
    MarkupsCore.prototype.activateTool = function(isActive) {
        if (isActive) {
            if (!this.cachedNavigationTool) {
                this.cachedNavigationTool = this.viewer.getActiveNavigationTool();
                this.viewer.addEventListener(Autodesk.Viewing.TOOL_CHANGE_EVENT, this.onToolChangeBinded);
            }
            this.viewer.setActiveNavigationTool(this.markupTool.getName());
        } else {

            if (this.cachedNavigationTool) {
                this.viewer.setActiveNavigationTool(this.cachedNavigationTool);
                this.cachedNavigationTool = null;
            } else {
                var defaultToolName = this.viewer.getDefaultNavigationToolName();
                this.viewer.setActiveNavigationTool(defaultToolName);
            }

            this.viewer.removeEventListener(Autodesk.Viewing.TOOL_CHANGE_EVENT, this.onToolChangeBinded);
        }
    };

    /**
     *
     * @param event
     * @private
     */
    MarkupsCore.prototype.onToolChange = function(event) {

        if (event.toolName !== this.markupTool.getName())
            return;

        if (event.active) {
            var navAllowed = this.isNavigationAllowed();
            this.viewer.setNavigationLockSettings({
                pan      : navAllowed,
                zoom     : navAllowed,
                orbit    : false,
                roll     : false,
                fov      : false,
                walk     : false,
                gotoview : false
            });
        }
        this.viewer.setNavigationLock(event.active);
    };

    MarkupsCore.prototype.onUnitsCalibrationStarts = function(event) {
        if (this.duringEditMode) {
            this.hide();
        }
    };

    //// Input /////////////////////////////////////////////////////////////////////////////////////////////////////////

    proto.changeInputHandler = function(inputHandler) {

        this.input.detachFrom(this);
        inputHandler.attachTo(this);
        this.input = inputHandler;

        if (this.duringEditMode) {
            inputHandler.enterEditMode();
        }

        if (this.duringViewMode) {
            inputHandler.enterViewMode();
        }
    };

    //// Copy and Paste System /////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Standard copy operation. Applies to any selected markup.<br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#cut|cut()} and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#paste|paste()}.
     */
    MarkupsCore.prototype.copy = function() {

        this.clipboard.copy();
    };

    /**
     * Standard cut operation. Applies to any selected markup, which gets removed from the screen at call time.<br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#copy|copy()} and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#paste|paste()}.
     */
    MarkupsCore.prototype.cut = function() {

        this.clipboard.cut();
    };

    /**
     * Standard paste operation. This function will paste any previously copied or cut markup.
     * Can be called repeatedly after a single copy or cut operation.<br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#copy|copy()} and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#cut|cut()}.
     */
    MarkupsCore.prototype.paste = function() {

        this.clipboard.paste();
    };

    //// Undo and Redo System //////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Will undo the previous operation.<br>
     * The Undo/Redo stacks will track any change done to the existing markups.<br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#redo|redo()} and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#isUndoStackEmpty|isUndoStackEmpty()}.
     */
    MarkupsCore.prototype.undo = function() {

        this.actionManager.undo();
    };

    /**
     * Will redo any previously undo operation.<br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#undo|undo()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#isRedoStackEmpty|isRedoStackEmpty()}.
     */
    MarkupsCore.prototype.redo = function() {

        this.actionManager.redo();
    };

    /**
     * Returns true when {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#undo|undo()}
     * produces no changes.
     * @return {boolean} true if there are no changes to undo; false if there are changes to undo.
     */
    MarkupsCore.prototype.isUndoStackEmpty = function() {

        return this.actionManager.isUndoStackEmpty();
    };

    /**
     * Returns true when {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#redo|redo()}
     * produces no changes.
     * @return {boolean} true if there are no changes to redo; false if there are changes to redo.
     */
    MarkupsCore.prototype.isRedoStackEmpty = function() {

        return this.actionManager.isRedoStackEmpty();
    };

    proto.beginActionGroup = function() {

        this.actionManager.beginActionGroup();
    };

    proto.closeActionGroup = function() {

        this.actionManager.closeActionGroup();
    };

    proto.cancelActionGroup = function() {

        this.actionManager.cancelActionGroup();
    };

    /**
     * Helper function for generating unique markup ids.
     * @returns {number}
     */
    proto.getId = function() {

        return ++this.nextId;
    };

    /**
     * @param event
     * @private
     */
    proto.onEditActionHistoryChanged = function(event) {

        var data = event.data;
        if((data.action !== 'undo' && data.targetId !== -1)) {

            // Markup can be null when deleting, that's ok, we unselect in that case.
            var markup = this.getMarkup(data.targetId);
            this.selectMarkup(markup);
        }
        if(data.action === 'undo' && !this.isUndoStackEmpty()) {

          var markup = this.getMarkup(this.actionManager.getLastElementInUndoStack().getTargetId());
          this.selectMarkup(markup);
        }

        this.dispatchEvent(event);
    };

    /**
     * Returns a markup with the specified ID. Returns null when not found.
     * The ID can be retrieved from the return value of getSelection(). <br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#getSelection|getSelection()}.
     * @param {string} id Markup identifier.
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.Markup} Returns markup object.
     */
    MarkupsCore.prototype.getMarkup = function(id) {

        var markups = this.markups;
        var markupsCount = markups.length;

        for(var i = 0; i < markupsCount; ++i) {
            if (markups[i].id == id) {
                return markups[i];
            }
        }

        return null;
    };


    /**
     * Selects or deselects a markup. A selected markup gets an overlayed UI that allows you to perform transformations
     * such as resizing, rotations, and translations. To deselect a markup, send a null value. <br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#getMarkup|getMarkup()}.
     * @param {Autodesk.Viewing.Extensions.Markups.Core.Markup|null} markup The markup instance to select. Set the value to null to deselect a markup.
     */
    MarkupsCore.prototype.selectMarkup = function(markup) {

        if (markup) {

            if (this.editMode.type === markup.type) {
                this.editMode.setSelection(markup);
            } else {

                var editMode = markup.getEditMode();
                editMode.setSelection(null);

                this.changeEditMode(editMode);
                this.setStyle(markup.getStyle());
                this.editMode.setSelection(markup);
            }
        } else {
            // fix for text markup in view mode
            if (this.editMode){
                this.editMode.setSelection(null);
            }
        }
    };

    /**
     * Returns the currently selected markup. A selected markup has a custom UI overlayed that allows you to perform
     * resizing, rotations and translations.<br>
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#selectMarkup|selectMarkup()}.
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.Markup|null} Returns selected markup object; null if no markup is selected.
     */
    MarkupsCore.prototype.getSelection = function() {

        return this.editMode.getSelection();
    };

    /**
     * Deletes a markup from the canvas. Only applies while in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|Edit mode}.
     * @param {Autodesk.Viewing.Extensions.Markups.Core.Markup} markup - Markup object.
     * @param {boolean} [dontAddToHistory] Whether delete action can be {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#undo|undone}.
     */
    MarkupsCore.prototype.deleteMarkup = function(markup, dontAddToHistory) {

        if (!this.editMode || (this.editMode && this.editMode.selectedMarkup.id !== markup.id)) {
            this.editMode = markup.getEditMode();
        }
        this.editMode.deleteMarkup(markup, dontAddToHistory);
    };

    proto.addMarkup = function(markup) {

        var markups;
        var layer = this.activeLayer;
        var layerObject = this.svgLayersMap[layer] || '';

        if (layerObject) {
            var svgParent = layerObject.svg;
            // append markup svg to layer svg
            markup.setParent(svgParent);
            // Add markup to layer markups if it does not exist
            layerObject.markups.push(markup);
            markups = layerObject.markups.slice();
        } else {
            // if layer is undefined create a edit mode svg layer
            markup.setParent(this.editModeSvgLayerNode.svg);
            this.editModeSvgLayerNode.markups.push(markup);
            markups = this.editModeSvgLayerNode.markups.slice();
        }
        
        markup.addEventListener(MarkupEvents.EVENT_MARKUP_SELECTED, this.onMarkupSelectedBinded);
        markup.addEventListener(MarkupEvents.EVENT_MARKUP_ENTER_EDITION, this.onMarkupEnterEditionBinded);
        markup.addEventListener(MarkupEvents.EVENT_MARKUP_CANCEL_EDITION, this.onMarkupCancelEditionBinded);
        markup.addEventListener(MarkupEvents.EVENT_MARKUP_DELETE_EDITION, this.onMarkupDeleteEditionBinded);
        // Only set the global markups array when in edit mode
        if (this.duringEditMode) {
            this.markups = markups;
        }
    };

    /**
     *
     * @param markup
     * @private
     */
    proto.removeMarkup = function(markup) {

        if (!markup){
            return false;
        }
        var self = this;

        /**
         * Get the layer markups in which the markup exists.
         * This function will remove the markup if it exists in the corresponding layer markups array.
         * @param markup
         * @returns {number} returns -1 if the markup does not exist in a layer markups array
         */
        function removeMarkupIfExists(markup){
            var markupIndex;
            var layerMarkups = -1;
            // check if the markup exists in the edit layer
            if (self.editModeSvgLayerNode){
                var editLayerMarkups = self.editModeSvgLayerNode.markups;
                markupIndex = editLayerMarkups.indexOf(markup);
                if (markupIndex !== -1) {
                    // remove the markup from the corresponding markup array
                    editLayerMarkups.splice(markupIndex, 1);
                    layerMarkups = editLayerMarkups.slice();
                    // update the global markups array if the markup is in the active layer
                    if (self.activeLayer === ''){
                        self.markups = layerMarkups;
                    }
                    return layerMarkups;
                }
            }
            // check if the markup exists in a layer
            if (self.svgLayersMap) {
                for (var layer in self.svgLayersMap) {
                    var markups = self.svgLayersMap[layer].markups;
                    markupIndex = markups.indexOf(markup);
                    if (markupIndex !== -1) {
                        // remove the markup from the corresponding markup array
                        markups.splice(markupIndex, 1);
                        layerMarkups = markups.slice();
                        // update the global markups array if the markup is in the active layer
                        if (self.activeLayer === layer){
                            self.markups = layerMarkups;
                        }
                        return layerMarkups;
                    }
                }
            }
            return layerMarkups;
        }

        var layerMarkups = removeMarkupIfExists(markup);
        if (layerMarkups === -1)
            return false;

        markup.setParent(null);

        markup.removeEventListener(MarkupEvents.EVENT_MARKUP_SELECTED, this.onMarkupSelectedBinded);
        markup.removeEventListener(MarkupEvents.EVENT_MARKUP_ENTER_EDITION, this.onMarkupEnterEditionBinded);
        markup.removeEventListener(MarkupEvents.EVENT_MARKUP_CANCEL_EDITION, this.onMarkupCancelEditionBinded);
        markup.removeEventListener(MarkupEvents.EVENT_MARKUP_DELETE_EDITION, this.onMarkupDeleteEditionBinded);

        var editMode = this.editMode;
        if (editMode) {
            var selectedMarkup = editMode.getSelection();
            if (selectedMarkup === markup) {
                this.selectMarkup(null);
            }
        }
    };

    //// Markups style /////////////////////////////////////////////////////////////////////////////////////////////////

    MarkupsCore.prototype.setStyle = function(style) {

        var styles = this.styles;
        var editMode = this.editMode;

        copyStyle(style, styles[editMode.type]);
        // copyStyle(styles[editMode.type], style);
        editMode.setStyle(styles[editMode.type]);
    };

    MarkupsCore.prototype.getStyle = function() {

        return cloneStyle(this.styles[this.editMode.type]);
    };

    MarkupsCore.prototype.getDefaultStyle = function() {

        var defaultStyleAttributes = [
            'stroke-width',
            'font-size',
            'font-family',
            'font-style',
            'font-weight',
            'stroke-color',
            'stroke-opacity',
            'fill-color',
            'fill-opacity'];
        this.defaultStyle = this.defaultStyle || createStyle(defaultStyleAttributes, this);

        return this.defaultStyle;
    };

    //// Markups depth order ///////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param markup
     */
    proto.bringToFront = function(markup) {

        this.sendMarkupTo(markup, this.markups.length-1);
    };

    /**
     *
     * @param markup
     */
    proto.sendToBack = function(markup) {

        this.sendMarkupTo(markup, 0);
    };

    /**
     *
     * @param markup
     */
    proto.bringForward = function(markup) {

        var markupIndex = this.markups.indexOf(markup);
        this.sendMarkupTo(markup, markupIndex+1);
    };

    /**
     *
     * @param markup
     */
    proto.bringBackward = function(markup) {

        var markupIndex = this.markups.indexOf(markup);
        this.sendMarkupTo(markup, markupIndex-1);
    };

    /**
     *
     * @param markup
     * @param index
     * @private
     */
    proto.sendMarkupTo = function(markup, index) {

        var markups = this.markups;
        var markupIndex = markups.indexOf(markup);

        if (markupIndex === -1 || index < 0 || index >= markups.length) {
            return;
        }

        markups.splice(markupIndex, 1);
        index = markupIndex > index ? index -1 : index;
        markups.splice(index, 0, markup);

        // TODO: Add markup in right position not always at the end.
        markup.setParent(null);
        if (this.activeLayer){
            var parent = this.svgLayersMap[this.activeLayer].svg;
            markup.setParent(parent);
        }else {
            markup.setParent(this.editModeSvgLayerNode.svg);
        }
    };


    /**
     * Loads data (SVG string) for all markups in a specified layer (layerId) to the Viewer's canvas.<br>
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#unloadMarkups|unloadMarkups()}, and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hideMarkups|hideMarkups()}.
     *
     * @param {string} markupString - SVG string with markups. See also {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#generateData|generateData()}.
     * @param {string} layerId - Identifier for the layer where the markup should be loaded to. Example "Layer1".
     * @return {boolean} Whether the markup string was able to be loaded successfully
     */
    MarkupsCore.prototype.loadMarkups = function (markupString, layerId) {

        function getDataModelVersion(node) {
            var metadata = node.childNodes[0] ? node.childNodes[0].childNodes[0] : null;
            var versionAttr = metadata && (typeof metadata.getAttribute === 'function') && metadata.getAttribute('data-model-version');

            return (typeof versionAttr === 'string') ? parseFloat(versionAttr) : null;
        }

        if (this.duringEditMode) {
            console.warn("Markups will not be loaded during the edit mode");
            return false;
        }

        if (!this.duringViewMode) {
            return false;
        }

        if (!layerId) {
            console.warn("loadMarkups failed; missing 2nd argument 'layerId'");
            return false;
        }

        // Can it be parsed into SVG?
        var parent = stringToSvgNode(markupString);
        if (!parent) {
            return false;
        }

        // var version = getDataModelVersion(parent);

        // If the supplied layerId exists in the svg layers map and there are children in the svg then return false.
        if (layerId in this.svgLayersMap && this.svg.childNodes.length > 0) {
            console.warn("This layer is already loaded, will not load again.");
            return false;
        }
        this.activeLayer = layerId;
        var svgLayerNode = this.svgLayersMap[layerId];

        // if the layer exists, delete it
        if (svgLayerNode)
            delete this.svgLayersMap[layerId];

        // create an empty parent svg layer node for layerId
        // Child markups will get added to th parent svg layer node in the addMarkup function
        var newSvg = this.createLayerNode();

        svgLayerNode = {
            markups: [],
            svgString: markupString,
            svg: newSvg
        };
        this.svgLayersMap[layerId] = svgLayerNode;

        var children = parent.childNodes;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            var markup = createMarkupFromSVG(child, this);
            // Disable markups if already in edit mode and the active layer is different
            if (markup && this.duringEditMode && this.editingLayer !== this.activeLayer) {
                markup.disableInteractions(true);
            }

            if (!markup && child.localName !== "metadata") {
                // Append child removes it from parent and copies it over to the new svg layer node,
                // so we need to reduce index by 1 to continue proper iteration
                svgLayerNode.svg.appendChild(child);
                i--;
                if (typeof child.setAttribute === 'function') {
                    child.setAttribute("pointer-events", "none");
                }
            }
        }

        var svgParentNode = this.svgLayersMap[this.activeLayer].svg;

        this.svg.appendChild(svgParentNode);
        // If already in an edit mode layer then reassign active layer to edit layer
        if(this.duringEditMode && this.editingLayer !== this.activeLayer) {
            this.activeLayer = this.editingLayer;
            if (this.editingLayer)
                this.markups = this.svgLayersMap[this.activeLayer].markups.slice();
        }
        return true;
    };

    /**
     * TODO: Probably this function needs to be moved to MarkupCoreUtils.js
     * Creates a new layer node
     * */

    proto.createLayerNode = function() {

        var newSvgLayerNode = this.createSvgElement('g');
        newSvgLayerNode.setAttribute('cursor', 'default');
        return newSvgLayerNode;
    };

    /**
     * Revert any changes made to the specific layer.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#loadMarkups|loadMarkups()} and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#enterEditMode|enterEditMode()}.
     *
     * @param {string} layerId - ID of the layer to revert any changes that were made to it.
     * @returns {boolean} true if the layer was unloaded, false if the layer was not unloaded.
     */
    MarkupsCore.prototype.revertLayer = function(layerId){
        if (!layerId) {
            console.warn("revertLayer failed because no layerId was supplied.");
            return false;
        }
        var svgLayerNode = this.svgLayersMap[layerId];
        if (!svgLayerNode){
            console.warn("The supplied layer does not exist.");
            return false;
        }
        var inEditMode = this.duringEditMode;
        // Leave editMode to revert a layer
        if (inEditMode)
            this.leaveEditMode();

        // keep track of previous global markups.
        var currentMarkups = this.markups.slice();
        // Set the global markups to the markups in the current layer. These ones get removed in the unloadMarkups
        this.markups = svgLayerNode.markups;
        var layerSvg = svgLayerNode.svgString;
        this.unloadMarkups(layerId);
        this.loadMarkups(layerSvg, layerId);
        // Assign markups
        if (this.editingLayer){
            if(this.editingLayer !== layerId) {
                this.markups = currentMarkups;
                var layerObject = this.svgLayersMap[this.editingLayer];
                if (layerObject) {
                    layerObject.markups = currentMarkups;
                }
            }
        }else{
            if(this.editModeSvgLayerNode){
                this.editModeSvgLayerNode.markups = currentMarkups;
            }
        }

        if(this.editingLayer || this.editingLayer.length === 0){
            var svg = this.editingLayer.length === 0 ? this.editModeSvgLayerNode.svg : this.svgLayersMap[this.editingLayer].svg;
            if (svg.parentNode == this.svg) {
                this.svg.removeChild(svg);
                this.svg.appendChild(svg);
            }
        }
        return true;
    };

    /**
     * Removes markups from the DOM (Document Object Model). This is helpful for freeing up memory.<br>
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#loadMarkups|loadMarkups()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#unloadMarkupsAllLayers|unloadMarkupsAllLayers()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#clear|clear()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hide|hide()}, and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hideMarkups|hideMarkups()}.
     *
     * @param {string} layerId - ID of the layer containing all markups to unload (from the DOM).
     * @return {boolean} Whether the operation succeeded or not.
     */
    MarkupsCore.prototype.unloadMarkups = function(layerId) {

        if (!layerId) {
            console.warn("unloadMarkups failed; No layerId provided.");
            return false;
        }

        var svgLayerNode = this.svgLayersMap[layerId];
        if (!svgLayerNode) {
            // TODO: Do we need to log anything here?
            console.warn('No such layer exists to unload.');
            return false;
        }

        var layerMarkups = svgLayerNode.markups.slice();
        var numMarkups = layerMarkups.length;
        for (var i = 0; i < numMarkups; i++) {
            var markup = layerMarkups[i];
            this.removeMarkup(markup);
            markup.destroy();
        }

        // Remove the markups in the layer from the svg canvas
        if (svgLayerNode.svg.parentNode === this.svg)
            this.svg.removeChild(svgLayerNode.svg);

        // Delete the layer from the layer map.
        delete this.svgLayersMap[layerId];
        // Reset the active layer if the supplied layer id is the same as the active layer
        if (this.activeLayer.toString() === layerId.toString()) {
            this.activeLayer = '';
        }
        // Leave edit mode and reset the editing layer if the supplied layer is the same as the current editing layer
        if (this.editingLayer && this.editingLayer.toString() === layerId.toString()){
            this.editingLayer = '';
            this.duringEditMode && this.leaveEditMode();
        }

        return true;
    };

    /**
     * Removes all markups loaded so far. Great for freeing up memory.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#loadMarkups|loadMarkups()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#unloadMarkups|unloadMarkups()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#clear|clear()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hide|hide()}, and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hideMarkups|hideMarkups()}.
     */
    MarkupsCore.prototype.unloadMarkupsAllLayers = function() {
        this.activeLayer = '';
        var self = this;

        //this is specific to the editModeSvgLayerNode, enterEditMode().
        var unloadSvgLayerNode = function(){
            if (self.editModeSvgLayerNode){
                var layerMarkups = self.editModeSvgLayerNode.markups.slice();
                var numMarkups = layerMarkups.length;
                for (var i = 0; i < numMarkups; i++) {
                    var markup = layerMarkups[i];
                    self.removeMarkup(markup);
                    markup.destroy();
                }
            }
        };

        // Unload the markups in the editModeSvgLayerNode
        unloadSvgLayerNode();
        var layerId;
        for (layerId in this.svgLayersMap){
            this.unloadMarkups(layerId);
        }
    };

    /**
     * Hides all markups in a specified layer. Note that hidden markups will not be unloaded.
     * Use the {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#showMarkups|showMarkups()} method to make
     * them visible again; no additional parsing is required.
     *
     * See also
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#showMarkups|showMarkups()},
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#unloadMarkups|unloadMarkups()}, and
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#loadMarkups|loadMarkups()}.
     *
     * @param {string} layerId - ID of the layer containing all markups that should be hidden (in the DOM).
     * @return {boolean} Whether the operation succeeded or not.
     */
    MarkupsCore.prototype.hideMarkups = function(layerId) {

        if (!layerId) {
            console.warn("hideMarkups failed; No layerId provided.");
            return false;
        }

        var svgLayerNode = this.svgLayersMap[layerId];
        if (!svgLayerNode) {
            // TODO: Do we need to log anything here?
            return false;
        }
        var layerSvg = svgLayerNode.svg;

        // Return false if the layer svg is not present in the main svg
        if (layerSvg.parentNode != this.svg) {
            console.warn("Layer is already hidden.");
            return false;
        }
        // remove the layer svg from the main svg
        this.svg.removeChild(layerSvg);
        return true;
    };

    /**
     * Unhides a layer of hidden markups
     * ({@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore/#hideMarkups|hideMarkups()}).
     *
     * @param {string} layerId - ID of the layer containing all markups to unload (from the DOM).
     * @return {boolean} Whether the operation succeeded or not.
     */
    MarkupsCore.prototype.showMarkups = function(layerId) {

        if (!layerId) {
            console.warn("showMarkups failed; No layerId provided.");
            return false;
        }

        var svgLayerNode = this.svgLayersMap[layerId];
        if (!svgLayerNode) {
            // TODO: Do we need to log anything here?
            return false;
        }
        // Append the layer svg to the main svg
        var layerSvg = svgLayerNode.svg;
        this.svg.appendChild(layerSvg);
    };

    //// Client Space <-> Markup Space /////////////////////////////////////////////////////////////////////////////////

    proto.positionFromClientToMarkups = function(x, y) {

        return this.clientToMarkups(x, y);
    };

    proto.positionFromMarkupsToClient = function(x, y) {

        return this.markupsToClient(x, y);
    };

    proto.vectorFromClientToMarkups = function(x, y) {

        var a = this.clientToMarkups(0, 0);
        var b = this.clientToMarkups(x, y);

        return {x: b.x - a.x, y: b.y - a.y};
    };

    proto.vectorFromMarkupsToClient = function(x, y) {

        var a = this.markupsToClient(0, 0);
        var b = this.markupsToClient(x, y);

        return {x: b.x - a.x, y: b.y - a.y};
    };

    proto.sizeFromClientToMarkups = function(w, h) {

        var a = this.clientToMarkups(0, 0);
        var b = this.clientToMarkups(w, h);

        return {x: Math.abs(b.x - a.x), y: Math.abs(b.y - a.y)};
    };

    proto.sizeFromMarkupsToClient = function(w, h) {

        var a = this.markupsToClient(0, 0);
        var b = this.markupsToClient(w, h);

        return {x: Math.abs(b.x - a.x), y: Math.abs(b.y - a.y)};
    };

    proto.markupsToClient = function(x, y) {

        var camera = this.viewer.impl.camera;
        var point = new THREE.Vector3(x, y, 0);

        if (camera.isPerspective) {

            var bb = this.viewer.impl.getCanvasBoundingClientRect();

            point.x =( point.x / PERSPECTIVE_MODE_SCALE * (bb.height * 0.5) + bb.width  * 0.5);
            point.y =(-point.y / PERSPECTIVE_MODE_SCALE * (bb.height * 0.5) + bb.height * 0.5);
        } else {

            point.applyMatrix4(camera.matrixWorld);
            point.sub(camera.position);

            // In LMV model is offset by a global offset, we correct this offset when transforming to markups space, so
            // exported markups don't have the offset.
            var globalOffset = this.viewer.model && this.viewer.model.getData().globalOffset;
            if (globalOffset) {
                point.sub(globalOffset);
            }

            point = worldToClient(point, this.viewer, false);
            point.z = 0;
        }

        return point;
    };

    proto.clientToMarkups = function(x, y) {

        var camera = this.viewer.impl.camera;
        var point = new THREE.Vector3(x, y, 0);

        if (camera.isPerspective) {

            var bb = this.viewer.impl.getCanvasBoundingClientRect();

            // Multiply by PERSPECTIVE_MODE_SCALE because Firfox on Windows machines have problems to deal with very small paths.
            point.x = (point.x - bb.width  * 0.5) / (bb.height * 0.5) * PERSPECTIVE_MODE_SCALE;
            point.y =-(point.y - bb.height * 0.5) / (bb.height * 0.5) * PERSPECTIVE_MODE_SCALE;
        } else {

            point = clientToWorld(point.x, point.y, 0, this.viewer);

            // In LMV model is offset by a global offset, we correct this offset when transforming to markups space, so
            // exported markups don't have the offset.
            var globalOffset = this.viewer.model && this.viewer.model.getData().globalOffset;
            if (globalOffset) {
                point.add(globalOffset);
            }

            point.add(camera.position);
            point.applyMatrix4(camera.matrixWorldInverse);
            point.z = 0;
        }

        return point;
    };

    proto.getSvgViewBox = function(clientWidth, clientHeight) {

        // Get pan offset.
        var lt = this.clientToMarkups(0, 0);
        var rb = this.clientToMarkups(clientWidth, clientHeight);

        var l = Math.min(lt.x, rb.x);
        var t = Math.min(lt.y, rb.y);
        var r = Math.max(lt.x, rb.x);
        var b = Math.max(lt.y, rb.y);

        return [l , t, r-l, b-t].join(' ');
    };

    proto.getBounds = function () {

        return this.bounds;
    };

    proto.getMousePosition = function() {

        // When snapping, use the snap position instead of the mouse position
        // as the start point of the markup drawing.
        // For now only works for 2D.
        if (this.editMode.useWithSnapping() && this.snapper && this.snapper.isSnapped()) {
            return this.getSnapPosition();
        }
        return this.input.getMousePosition();
    };

    proto.getSnapPosition = function() {

        var point = MeasureCommon.getSnapResultPosition(this.snapper.getSnapResult(), this.viewer);
        var p = this.project(point);
        return {x: p.x, y: p.y};
    };

    proto.project = function(position) {
        var camera = this.viewer.navigation.getCamera();
        var containerBounds = this.viewer.navigation.getScreenViewport();

        var p = new THREE.Vector3().copy(position);
        p.project(camera);

        return new THREE.Vector3(Math.round((p.x + 1) / 2 * containerBounds.width),
            Math.round((-p.y + 1) / 2 * containerBounds.height), p.z);
    };

    //// Handled Events ////////////////////////////////////////////////////////////////////////////////////////////////

    proto.onCameraChange = function(event) {

        // Update annotations' parent transform.
        var viewBox = this.getSvgViewBox(this.bounds.width, this.bounds.height);

        // HACK, for some reason the 2nd frame returns an empty canvas.
        // The reason why this happens is that the code above calls into the viewer
        // and a division by zero occurs due to LMV canvas having zero width and height
        // When we detect this case, avoid setting the viewBox value and rely on one
        // previously set.
        if (viewBox === "NaN NaN NaN NaN") {
            return;
        }

        if (this.svg) {
            this.svg.setAttribute('viewBox', viewBox);
        }


        var editMode = this.editMode;

        if (editMode) {
            // Edit frame has to be updated, re-setting the selected markup does the job.
            if (this.editFrame.isActive()) {
                var selectedMarkup = editMode.getSelection();
                this.editFrame.setMarkup(selectedMarkup);
            }

            if (editMode.updateTextBoxStyle) {
                editMode.updateTextBoxStyle();
            }

            if (this.snapper && editMode.useWithSnapping()) {
                this.snapper.indicator.render();
            }
        }
    };

    proto.onViewerResize = function(event) {

        this.bounds.x = 0;
        this.bounds.y = 0;
        this.bounds.width = event.width;
        this.bounds.height = event.height;

        if (this.svg) {
            this.svg.setAttribute('width', this.bounds.width);
            this.svg.setAttribute('height', this.bounds.height);
        }

        this.onCameraChange();
    };

    proto.callSnapperMouseDown = function() {

        // Disable snapper in freehand mode
        if (this.editMode && this.editMode.useWithSnapping()){
            var mousePosition = this.input.getMousePosition();
            if (this.snapper) {
                this.snapper.onMouseDown(mousePosition);
                this.snapper.indicator.render();
            }
        }else{
            // Clear the snapper when selecting a markup that does not allow snapping.
            if (this.snapper){
                this.snapper.clearSnapped();
                this.snapper.indicator.clearOverlays();
            }
        }
    };

    proto.callSnapperMouseMove = function() {

        if (this.editMode && this.editMode.useWithSnapping()) {
            var mousePosition = this.input.getMousePosition();
            if (this.snapper) {
                this.snapper.onMouseMove(mousePosition);
                this.snapper.indicator.render();
            }
        }
    };

    /**
     * Handler to mouse move events, used to create markups.
     * @private
     */
    proto.onMouseMove = function(event) {

        if (this.navigating) {
            return;
        }

        if (this.editFrame.isActive() && event.type === 'mousemove') {
            this.editFrame.onMouseMove(event);
        }

        this.callSnapperMouseMove();

        this.editMode && this.editMode.onMouseMove(event);
    };

    /**
     * Handler to mouse down events, used to start creation markups.
     * @private
     */
    proto.onMouseDown = function(event) {

        dismissLmvHudMessage();

        this.callSnapperMouseDown();

        var bounds = this.getBounds();
        var mousePosition = this.getMousePosition();

        if (mousePosition.x >= bounds.x && mousePosition.x <= bounds.x + bounds.width &&
            mousePosition.y >= bounds.y && mousePosition.y <= bounds.y + bounds.height) {
            this.editMode.onMouseDown(event);
        }

        // TODO: There is a better way to do this, implement when undo/redo group.
        if(!this.editMode.creating && event.target === this.svg) {
            this.selectMarkup(null);
        }
        this.ignoreNextMouseUp = false;
    };

    proto.onMouseUp = function(event) {

        if (this.navigating) {
            return;
        }

        if (this.editFrame.isActive()) {
            this.editFrame.onMouseUp(event);
            return;
        }

        if(!this.ignoreNextMouseUp) {
            this.editMode.onMouseUp(event);
        }
    };

    proto.onMouseDoubleClick = function(event) {

        if (this.navigating) {
            return;
        }

        if (this.editFrame.isActive()) {
            return;
        }

        this.editMode.onMouseDoubleClick(event);
    };

    proto.onUserCancel = function() {
        if (!this.editMode) {
            return;
        }
        else if (this.editMode.creating) {
            this.editMode.creationCancel();
        } else {
            this.editMode.unselect();
        }
    };

    /**
     *
     * @param event
     */
    proto.onMarkupSelected = function(event) {

        this.selectMarkup(event.markup);
        this.dispatchEvent(event);
    };

    proto.onMarkupEnterEdition = function(event) {

    };

    proto.onMarkupCancelEdition = function(event) {

        this.onUserCancel();
    };

    proto.onMarkupDeleteEdition = function(event) {

        this.removeMarkup(event.markup);
        this.editMode.deleteMarkup();
    };

    Autodesk.Viewing.theExtensionManager.registerExtension('Autodesk.Viewing.MarkupsCore', MarkupsCore);
