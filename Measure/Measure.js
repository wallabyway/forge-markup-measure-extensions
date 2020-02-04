import { MeasureTool } from './MeasureTool'
import { CalibrationTool } from './CalibrationTool'
import { MagnifyingGlass } from './MagnifyingGlass'
import { CalibrationRequiredDialog } from './CalibrationPanels'
import { MeasureToolbar } from './MeasureToolbar'


import CSS_1 from './Measure.css'       // IMPORTANT!!
import CSS_2 from './Calibration.css'   // IMPORTANT!!

'use strict';

var avem = AutodeskNamespace('Autodesk.Viewing.Extensions.Measure'),
    av = Autodesk.Viewing,
    avp = Autodesk.Viewing.Private,
    avu = av.UI;
var MeasureCommon = Autodesk.Viewing.MeasureCommon; // Comes form main viewer bundle.

var NONE = 0;
var MEASURE_TOOL = 1;
var CALIBRATION_TOOL = 2;

var DEFAULT_MEASUREMENT_TYPE = MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE;

/**
 * Provides UI controls to perform distance and angle measurements for 2D and 3D models.
 * 
 * The extension id is: `Autodesk.Measure`
 * 
 * @example
 *   viewer.loadExtension('Autodesk.Measure')
 *  
 * @memberof Autodesk.Viewing.Extensions
 * @alias Autodesk.Viewing.Extensions.MeasureExtension
 * @see {@link Autodesk.Viewing.Extension} for common inherited methods.
 * @constructor
*/
export var MeasureExtension = function(viewer, options) {
    Autodesk.Viewing.Extension.call(this, viewer, options);
    this.modes = ['distance','angle','area','calibrate'];
    this.name = 'measure';
    this._onModelLoaded = this._onModelLoaded.bind(this);
};

MeasureExtension.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
MeasureExtension.prototype.constructor = MeasureExtension;


/**
 * Load the measure extension.
 * @returns {boolean} True if measure extension is loaded successfully.
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#load
*/
MeasureExtension.prototype.load = async function() {

    await this.viewer.loadExtension('Autodesk.Snapping');

    var self   = this;
    var viewer = this.viewer;
    this.hasUI = Autodesk.Viewing.GuiViewer3D && viewer instanceof Autodesk.Viewing.GuiViewer3D;

    this.escapeHotkeyId = 'Autodesk.Measure.Hotkeys.Escape';

    // Register the Measure tool
    if (!viewer.toolController){
        return false;
    }

    this.options = this.options || {};
    var measureToolOptions = {};

    measureToolOptions.onCloseCallback = function() {
        self.enableMeasureTool(false);
    };

    // Shared State with measureTool & calibrationTool.
    // Gets populated when a model is received.
    this.sharedMeasureConfig = { 
        units: null,
        precision: null,
        calibrationFactor: null
    };

	measureToolOptions.snapperOptions = this.options.snapperOptions;

    this.forceCalibrate = this.options.forceCalibrate;

    this.snapper = new Autodesk.Viewing.Extensions.Snapping.Snapper(viewer, {
        renderSnappedTopology: true
    });
    viewer.toolController.registerTool(this.snapper);

    this.measureTool = new MeasureTool(viewer, measureToolOptions, this.sharedMeasureConfig, this.snapper);
    viewer.toolController.registerTool(this.measureTool);

    this.calibrationTool = new CalibrationTool(viewer, this.options, this.sharedMeasureConfig, this.snapper);
    viewer.toolController.registerTool(this.calibrationTool);

    this.magnifyingGlass = new MagnifyingGlass(viewer);
    viewer.toolController.registerTool(this.magnifyingGlass);

    this.calibration = {};
    this.onFinishedCalibration = function(event) {
        if (self.measureToolbar) {
            self.measureToolbar.updateSettingsPanel();
        }

        self.activateInitiator && self.activateInitiator();

        // Set the calibration values
        self.calibration.units = event.units;
        self.calibration.scaleFactor = event.scaleFactor;
        self.calibration.size = event.size;
        self.calibration.precision = self.sharedMeasureConfig.precision;
    };

    viewer.addEventListener('finished-calibration', this.onFinishedCalibration);

    this.onMeasurementChanged = function(event) {
        var type = event.data.type;
        self.changeMeasurementType(type);
    };

    viewer.addEventListener(MeasureCommon.Events.MEASUREMENT_CHANGED_EVENT, this.onMeasurementChanged);

    if (viewer.model) {
        this._onModelLoaded({ model: viewer.model });
    } else {
        viewer.addEventListener(av.MODEL_ROOT_LOADED_EVENT, this._onModelLoaded, { once: true });
    }

    // If there is no model anymore, interrupt any ongoing interaction.
    // We need at least one model to derive things like is2d() and model units.
    this.onModelRemoved = function() {
        // If UI was not created yet or destroyed, we don't have to disable anything
        if (!self.measurementToolbarButton) {
            return;
        }
                
        if (!self.viewer.model) {
            self.measurementToolbarButton.setState(Autodesk.Viewing.UI.Button.State.DISABLED);
            self.exitMeasurementMode();
        }
    };
    this.onModelAdded = function() {

        // If UI was not created yet or destroyed, the button will be enabled in next createUI() call
        if (!self.measurementToolbarButton) {
            return;
        }

        // On first model-add, re-enable measure toolbar again
        var modelCount = self.viewer.getVisibleModels().length;
        if (modelCount === 1 && self.measurementToolbarButton) {
            self.measurementToolbarButton.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
        }
    };
    viewer.addEventListener(av.MODEL_ADDED_EVENT, this.onModelAdded);
    viewer.addEventListener(av.MODEL_REMOVED_EVENT, this.onModelRemoved);
};

MeasureExtension.prototype._onModelLoaded = function(event) {
    var model = event.model;

    const setPdfUnits = !!model.getData().isPdf && !this.viewer.prefs.get(avp.Prefs2D.FORCE_PDF_CALIBRATION);
    const setLeafletUnits = !!model.getData().isLeaflet && !this.viewer.prefs.get(avp.Prefs2D.FORCE_LEAFLET_CALIBRATION);

    this.sharedMeasureConfig.units = this.options.calibrationUnits || model.getDisplayUnit();

    // Set the units to points only for pdf and leaflet models that do not contain model units in the metadata.
    if ((setPdfUnits || setLeafletUnits) && !model.getMetadata('page_dimensions', 'model_units', null)) {
        this.sharedMeasureConfig.units = 'pt';
    }

    this.sharedMeasureConfig.precision = model.is2d() ? 3 : 1;

    if (this.options.calibrationUnits && !isNaN(this.options.calibrationFactor)) {
        this.calibrationTool.calibrateByScale(this.options.calibrationUnits, this.options.calibrationFactor);
    }
}

/**
 * Unload the measure extension.
 * @returns {boolean} True if measure extension is unloaded successfully.
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#unload
*/
MeasureExtension.prototype.unload = function () {
    var viewer = this.viewer;

    // Remove the ui from the viewer.
    this.destroyUI();

    viewer.removeEventListener('finished-calibration', this.onFinishedCalibration);
    viewer.removeEventListener(MeasureCommon.Events.MEASUREMENT_CHANGED_EVENT, this.onMeasurementChanged);
    viewer.removeEventListener(av.MODEL_ADDED_EVENT, this.onModelAdded);
    viewer.removeEventListener(av.MODEL_REMOVED_EVENT, this.onModelRemoved);
    viewer.removeEventListener(av.MODEL_ROOT_LOADED_EVENT, this._onModelLoaded);

    viewer.toolController.deregisterTool(this.snapper);
    this.snapper = null;

    viewer.toolController.deregisterTool(this.measureTool);
    this.measureTool = null;

    viewer.toolController.deregisterTool(this.calibrationTool);
    this.calibrationTool = null;

    viewer.toolController.deregisterTool(this.magnifyingGlass);
    this.magnifyingGlass = null;

    this.unloaded = true;
    return true;
};

/**
 * Enable/disable the measure tool.
 * It does not update the toolbar UI.
 * 
 * @param {boolean} active - True to activate, false to deactivate.
 * @returns {boolean} True if a change in activeness occurred.
 */
MeasureExtension.prototype.setActive = function(active) {
    return this.enableMeasureTool(active);
};

/**
 * Toggles activeness of the measure tool.
 * It does not update the toolbar UI.
 * 
 * @return {boolean} Whether the tool is active.
 */
MeasureExtension.prototype.toggle = function() {
    if (this.isActive()) {
        this.enableMeasureTool(false);
    } else {
        this.enableMeasureTool(true);
    }
    return this.isActive();
};

/**
 * Get the current measurement in the measure tool.
 * @param {string} [unitType] - Either: "decimal-ft", "ft", "ft-and-decimal-in", "decimal-in", "fractional-in", "m", "cm", "mm" or "m-and-cm".
 * @param {number} [precision] - precision index (0: 0, 1: 0.1, 2: 0.01, 3: 0.001, 4: 0.0001, 5: 0.00001).
 * When units type is "ft", "in" or "fractional-in", then the precisions are 0: 1, 1: 1/2, 2: 1/4, 3: 1/8, 4: 1/16, 5: 1/32, 6: 1/64.
 * @returns {object|null} Object with properties of the current measurement, or null.
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#getMeasurement
 */
MeasureExtension.prototype.getMeasurement = function(unitType, precision) {
    var measurement = null;
    if (this.measureTool.isActive()) {
        measurement = this.measureTool.getMeasurement(unitType, precision);
    }
    return measurement;
};

/**
 * Get a list of all the measurements that are currently on the screen.
 * @param {string} [unitType] - Either: "decimal-ft", "ft", "ft-and-decimal-in", "decimal-in", "fractional-in", "m", "cm", "mm" or "m-and-cm".
 * @param {number} [precision] - precision index (0: 0, 1: 0.1, 2: 0.01, 3: 0.001, 4: 0.0001, 5: 0.00001).
 * When units type is "ft", "in" or "fractional-in", then the precisions are 0: 1, 1: 1/2, 2: 1/4, 3: 1/8, 4: 1/16, 5: 1/32, 6: 1/64.
 * @returns {Array.<Object>} An array of measurement objects with properties of the measurement.
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#getMeasurementList
 */

MeasureExtension.prototype.getMeasurementList = function(unitType, precision) {
  var measurementList = [];
  if(this.measureTool.isActive()) {
      measurementList = this.measureTool.getMeasurementList(unitType, precision);
  }
  return measurementList;
}

/**
 * Restores existing measurements. The `measurements` object should be generated by either the {@link Autodesk.Viewing.Extensions.MeasureExtension#getMeasurementList|getMeasurementList} or the {@link Autodesk.Viewing.Extensions.MeasureExtension#getMeasurement|getMeasurement} methods.
 * @param {Object[]|Object} measurements - An array of measurement objects
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#setMeasurements
 */
MeasureExtension.prototype.setMeasurements = function(measurements) {
    if (this.measureTool.isActive()) {
        this.measureTool.setMeasurements(measurements);
    }
};


/**
 * Get all available units in measure tool.
 * @returns {object[]} Array of all available units.
*/
MeasureExtension.prototype.getUnitOptions = function() {
    var units = [
        { name: 'Unknown', type: '' },
        { name: 'Decimal feet', type: 'decimal-ft' },
        { name: 'Feet and fractional inches', type: 'ft' },
        { name: 'Feet and decimal inches', type: 'ft-and-decimal-in' },
        { name: 'Decimal inches', type: 'decimal-in' },
        { name: 'Fractional inches', type: 'fractional-in' },
        { name: 'Meters', type: 'm' },
        { name: 'Centimeters', type: 'cm' },
        { name: 'Millimeters', type: 'mm' },
        { name: 'Meters and centimeters', type: 'm-and-cm' },
        { name: 'Points', type: 'pt' }
    ];

    return units;
};

/**
 * Get all available precisions in measure tool.
 * @param {boolean} isFractional - Set true to get fractional precisions.
 * @return {string[]} List of all available precisions.
*/
MeasureExtension.prototype.getPrecisionOptions = function(isFractional) {

    var precisions;

    if (isFractional)
        precisions = ['1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64'];
    else
        precisions = ['0', '0.1', '0.01', '0.001', '0.0001', '0.00001'];

    return precisions;
};

/**
 * Get the default measure unit in measure tool.
 * @returns {string} The default measure unit.
*/
MeasureExtension.prototype.getDefaultUnit = function() {
    var unit = this.viewer.model.getDisplayUnit();

    return unit;
};

MeasureExtension.prototype.openCalibrationRequiredDialog = function (initiator) {
    if (this.hasUI) {
        if (!this.CalibrationRequiredDialog) {
            this.CalibrationRequiredDialog = new CalibrationRequiredDialog(this, this.viewer, "calibration-required", "Calibration Required", this.options );
        }

        this.CalibrationRequiredDialog.setVisible(true);
    }
    else {
        this.viewer.dispatchEvent({ type: MeasureCommon.Events.CALIBRATION_REQUIRED_EVENT });
    }

    if (initiator === 'measure') {
        this.activateInitiator = function() {
            this.enableMeasureTool(true, DEFAULT_MEASUREMENT_TYPE);
            this.activateInitiator = null;
        };
    } else if (initiator === 'dimension') {
        this.activateInitiator = function() {
            this.viewer.dispatchEvent({ type: MeasureCommon.Events.FINISHED_CALIBRATION_FOR_DIMENSION_EVENT });
            this.activateInitiator = null;
        };
    }
};

/**
 * Get the calibration size, unit type and the calibration Factor of the model
 * @returns {Object}
 */
MeasureExtension.prototype.getCalibration = function() {
    return this.calibration;
};


/**
 * @param mode Measurement Mode
 * @returns {boolean}
 */

 /**
  * Activates the tool and UI to start measuring.
  * 
  * @param {string} [mode] - Either 'distance', 'angle', 'area' (2D only) or 'calibrate'. Default is 'distance'.
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#activate
  */
MeasureExtension.prototype.activate = function (mode) {
    if (this.activeStatus && this.mode === mode) {
        return true;
    }
    this.enterMeasurementMode();

    var success;

    switch (mode) {
        default:
            mode = 'distance';
        case 'distance':
            success = this.enableMeasureTool(true, MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE);
            break;
        case 'angle':
            success = this.enableMeasureTool(true, MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE);
            break;
        case 'area':
            if(!this.viewer.model.is2d()) {
                console.warn('Area mode is applicable on 2D models only');
            } else {
                success = this.enableMeasureTool(true, MeasureCommon.MeasurementTypes.MEASUREMENT_AREA);
            }
            break;
        case 'calibrate':
            success = this.enableCalibrationTool(true);
            break;
    }

    this.mode = success ? mode : '';
    this.activeStatus = true;
    return true;
};

/**
 * Deactivates measuring tool and UI.
 * 
 * @returns {boolean}
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#deactivate
 */
MeasureExtension.prototype.deactivate = function () {
    if(this.activeStatus) {
        this.exitMeasurementMode();
        this.enableMeasureTool(false);
        this.activeStatus = false;
    }
    return true;
};

/**
 * Force the calibration panel for pdf models
 * @param {Boolean} enable - true to force the calibration panel
 */
MeasureExtension.prototype.setForcePDFCalibrate = function(enable) {
    this.viewer.prefs.set(avp.Prefs2D.FORCE_PDF_CALIBRATION, enable);
};

/**
 * Force the calibration panel for leaflet models
 * @param {Boolean} enable - true to force the calibration panel
 */
MeasureExtension.prototype.setForceLeafletCalibrate = function(enable) {
    this.viewer.prefs.set(avp.Prefs2D.FORCE_LEAFLET_CALIBRATION, enable);
};

/**
 * Restore session measurements when enabling the measure tool.
 * @param {Boolean} enable - true to restore session measurements. 
 */
MeasureExtension.prototype.setRestoreSessionMeasurements = function(enable) {
    this.viewer.prefs.set(avp.Prefs.RESTORE_SESSION_MEASUREMENTS, enable);
}

/**
 * Enable/disable the measure tool.
 * @param {boolean} enable - True to enable, false to disable.
 * @returns {boolean} True if the tool state was changed.
 * @private
 */
MeasureExtension.prototype.enableMeasureTool = function(enable, measurementType) {
    if (measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_AREA && this.viewer.model && !this.viewer.model.is2d()) {
        return false;
    }

    var toolController = this.viewer.toolController,
        isActive = (this.selectedTool === MEASURE_TOOL);

    if (!this.viewer.model || (!enable && isActive)) {
        if (this.measureTool.isActive()) {
            toolController.deactivateTool("measure");

            if (this.measureToolbar) {
                this.measureToolbar.deactivateAllButtons();
            }

            // No tool is active anymore. Only do this if measureTool was really the active one before.
            // If not, changing selectedTool would produce an inconsistent state, e.g., CalibrationTool 
            // may still be active, but enableCalibrationTool(false) would not properly close it.
            this.selectedTool = NONE;
        }

        return true;
    }

    const forcePDFCalibration = this.viewer.model.getData().isPdf && this.viewer.prefs.get(avp.Prefs2D.FORCE_PDF_CALIBRATION);
    const forceLeafletCalibration = this.viewer.model.getData().isLeaflet && this.viewer.prefs.get(avp.Prefs2D.FORCE_LEAFLET_CALIBRATION);

    this.forceCalibrate |= forceLeafletCalibration || forcePDFCalibration;

    if (!measurementType) {
        measurementType = DEFAULT_MEASUREMENT_TYPE;
    }

    if (enable && !isActive) {
        // Fetch topology when opening Measure tool for the first time.
        this.checkAndFetchTopology(toolController.getTool('measure'));

        if (!this.forceCalibrate || (this.forceCalibrate && this.calibrationTool.isCalibrated()) || measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE) {
            if (this.calibrationTool.isActive()) {
                toolController.deactivateTool("calibration");
            }
            
            if (this.measureToolbar) {
                this.measureToolbar.updateSettingsPanel();
            }

            toolController.activateTool("measure");

            this.selectedTool = MEASURE_TOOL;

            

            this.changeMeasurementType(measurementType);
            return true;
        }
        else {
            this.viewer.addEventListener(avem.OPEN_TOOL_AFTER_CALIBRAION, function(){
                this.enableMeasureTool(true);                
            }.bind(this), {once: true});
            
            this.openCalibrationRequiredDialog('measure');
            return false;
        }

    } else if (enable && isActive) {
        if (!this.forceCalibrate || (this.forceCalibrate && this.calibrationTool.isCalibrated()) || measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE) {
            this.changeMeasurementType(measurementType);
            return true;
        }
        else {
            this.openCalibrationRequiredDialog('measure');
            return false;
        }
    }

    return false;
};

MeasureExtension.prototype.changeMeasurementType = function(measurementType) {
    this.measureTool.changeMeasurementType(measurementType);
    if (this.measureToolbar) {
        this.measureToolbar.deactivateAllButtons();
        this.measureToolbar.activateButtonByType(measurementType);
    }

    switch (measurementType) {
        case MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE:
            this.mode = 'distance';
            break;
        case MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE:
            this.mode = 'angle'
            break;
        case MeasureCommon.MeasurementTypes.MEASUREMENT_AREA:
            this.mode = 'area';
            break;
        default:
            this.mode = '';
    }
};

/**
 * When enabled, the Viewer will only render model parts that are included in
 * measurements.
 *
 * @param {boolean} enable - true to render only nodes being measured.
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#setIsolateMeasure
 */
MeasureExtension.prototype.setIsolateMeasure = function(enable) {
    this.measureTool.setIsolateMeasure(enable);
    if (enable) {
        this.measureTool.isolateMeasurement();
    } else {
        this.measureTool.clearIsolate();
    }
}

/**
 * Enable/disable the measure tool.
 * @param {boolean} enable - True to enable, false to disable.
 * @returns {boolean} True if the tool state was changed.
 * @private
 */
MeasureExtension.prototype.enableCalibrationTool = function(enable) {
    var toolController = this.viewer.toolController,
        isActive = (this.selectedTool == CALIBRATION_TOOL);

    if (enable && !isActive) {
        if (this.measureTool.isActive()) {
            toolController.deactivateTool("measure");
        }
        
        toolController.activateTool("calibration");
        this.viewer.dispatchEvent({ type: MeasureCommon.Events.UNITS_CALIBRATION_STARTS_EVENT });
        
        if (this.measureToolbar) {
            this.measureToolbar.deactivateAllButtons();
            this.measureToolbar.activateButtonByType(MeasureCommon.MeasurementTypes.CALIBRATION);
        }

        this.selectedTool = CALIBRATION_TOOL;
        return true;

    } else if (!enable && isActive) {
        if (this.calibrationTool.isActive()) {
            this.mode = '';
            toolController.deactivateTool("calibration");
            if (this.measureToolbar) {
                this.measureToolbar.deactivateAllButtons();
            }
        }

        this.selectedTool = NONE;
        return true;
    }
    return false;
};

/**
 * @private
 */
MeasureExtension.prototype.enterMeasurementMode = function() {

    if (this._measurementMode) return;
    this._measurementMode = true;

    this.viewer.dispatchEvent({type: MeasureCommon.Events.MEASUREMENT_MODE_ENTER});

    if (!this.viewer.getToolbar) {
        return; // Adds support for Viewer3D instance
    }

    var toolbar = this.viewer.getToolbar();    
    var viewerToolbarContainer = toolbar.container;
    var viewerContainerChildrenCount = viewerToolbarContainer.children.length;
    for(var i = 0; i < viewerContainerChildrenCount; ++i) {
        viewerToolbarContainer.children[i].style.display = "none";
    }

    this.navigationControls = toolbar.getControl(Autodesk.Viewing.TOOLBAR.NAVTOOLSID);
    this.navigationControls.setVisible(true);
    this.navigationControls.container.style.display = '';

    this.measureControls = toolbar.getControl(Autodesk.Viewing.TOOLBAR.MEASURETOOLSID);
    this.measureControls.setVisible(true);
    this.measureControls.container.style.display = '';
    
    var measureButtonId = this.measurementToolbarButton.getId();
    this.measurementToolbarButton.index = this.measurementToolbarButton.parent.indexOf(measureButtonId);
    this.measurementToolbarButton.parent.removeControl(measureButtonId);

    this.measureToolbar.toggleVisible();

    if (this.viewer.centerToolBar) {
        this.viewer.centerToolBar();
    }

    this.enableMeasureTool(true, DEFAULT_MEASUREMENT_TYPE);
};

/**
 * @private
 */
MeasureExtension.prototype.exitMeasurementMode = function() {
    if (!this._measurementMode) return;

    this.viewer.dispatchEvent({type: MeasureCommon.Events.MEASUREMENT_MODE_LEAVE});

    this.measureToolbar && this.measureToolbar.closeToolbar();
    if (this.CalibrationRequiredDialog && this.CalibrationRequiredDialog.isVisible()) {
        this.CalibrationRequiredDialog.setVisible(false);
    }
    this._measurementMode = false;
};

/**
 * Create measure button in toolbar.
 * @private
*/
MeasureExtension.prototype.onToolbarCreated = function(toolbar)
{
    if (this.measureToolbar) {
        return;
    }

    var self   = this;
    var viewer = this.viewer;

    // Add Measure button to toolbar
    var modelTools = toolbar.getControl(av.TOOLBAR.MODELTOOLSID);
    this.measurementToolbarButton = new avu.Button('toolbar-measurementSubmenuTool');
    this.measurementToolbarButton.setToolTip('Measure');
    this.measurementToolbarButton.setIcon("adsk-icon-measure");
    modelTools.measurementToolbarButton = this.measurementToolbarButton;
    modelTools.addControl(this.measurementToolbarButton, {index:0});

    // Set button enabled if and only if there is >=1 visible model. Otherwise, it will remain disabled until next model-add event.
    var state = this.viewer.model ? Autodesk.Viewing.UI.Button.State.INACTIVE : Autodesk.Viewing.UI.Button.State.DISABLED;
    this.measurementToolbarButton.setState(state);

    this.measureToolbar = new MeasureToolbar(this);
    this.measureToolbar.init();

    this.measurementToolbarButton.onClick = this.activate.bind(this);

    // Escape hotkey to exit tool.
    //
    var hotkeys = [{
        keycodes: [
            Autodesk.Viewing.KeyCode.ESCAPE
        ],
        onRelease: function () {
            if (self._measurementMode) {
                self.exitMeasurementMode();
                return true;
            }
        }
    }];
    viewer.getHotkeyManager().pushHotkeys(this.escapeHotkeyId, hotkeys);
};


/**
 * @private
 */
MeasureExtension.prototype.checkAndFetchTopology = function(tool) {

    if (this._checkedTopology) {
        return;
    }

    this._checkedTopology = true;
    if (!this.viewer.model.is3d()) {
        tool && tool.setNoTopology();
        return;
    }

    if (this.viewer.modelHasTopology()){
        tool && tool.setTopologyAvailable();
        return;
    }

    // Fetch topology from backend.
    tool && tool.setFetchingTopology();
    this.viewer.model.fetchTopology()
    .then(function(topoData){
        tool && tool.setTopologyAvailable();
    })
    .catch(function(err){
        avp.logger.log(err); // No topology
        tool && tool.setNoTopology();
    });
};

/**
 * Destroy measure button in toolbar.
 * @private
*/
MeasureExtension.prototype.destroyUI = function()
{
    var viewer = this.viewer;

    if (this.measureToolbar) {
         this.measureToolbar.destroy();
         this.measureToolbar = null;
    }

    if (this.measurementToolbarButton) {
        this.measurementToolbarButton.removeFromParent();
        this.measurementToolbarButton = null;
    }

    viewer.getHotkeyManager().popHotkeys(this.escapeHotkeyId);
};

MeasureExtension.prototype.setUnits = function(units) {
    this.measureTool.setUnits(units);
};

MeasureExtension.prototype.getUnits = function() {
    return this.measureTool.getUnits();
};

MeasureExtension.prototype.setPrecision = function(precision) {
    this.measureTool.setPrecision(precision);
};

MeasureExtension.prototype.getPrecision = function() {
    return this.measureTool.getPrecision();
};

MeasureExtension.prototype.calibrate = function(requestedUnits, requestedSize) {
    this.calibrationTool.calibrate(requestedUnits, requestedSize);
};

MeasureExtension.prototype.calibrateByScale = function(requestedUnits, requestedScale) {
    this.calibrationTool.calibrateByScale(requestedUnits, requestedScale);
};

MeasureExtension.prototype.isCalibrationValid = function(requestedUnits, requestedSize) { 
    return this.calibrationTool.isCalibrationValid(requestedUnits, requestedSize); 
};

MeasureExtension.prototype.getCalibrationFactor = function() {
    return this.calibrationTool.getCalibrationFactor();
};

MeasureExtension.prototype.showAddCalibrationLabel = function() {
    this.calibrationTool.showAddCalibrationLabel();
};

/**
 * Delete all measurements.
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#deleteAllMeasurements
 */
MeasureExtension.prototype.deleteMeasurements = function() {
    this.measureTool.deleteMeasurements();
};

/**
 * Deletes the selected measurement.
 * 
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#deleteCurrentMeasurement
 */
MeasureExtension.prototype.deleteCurrentMeasurement = function() {
    this.measureTool.deleteCurrentMeasurement();
};

MeasureExtension.prototype.selectMeasurementById = function(id) {
    this.measureTool.selectMeasurementById(id);
};

/**
 * Enable measuring on non snapped locations.
 * @alias Autodesk.Viewing.Extensions.MeasureExtension#setFreeMeasureMode
 * @param {Boolean} allow - true to allow measuring on non snapped locations, otherwise false;
 */
MeasureExtension.prototype.setFreeMeasureMode = function(allow) {
    this.snapper.setSnapToPixel(allow);
};

av.theExtensionManager.registerExtension('Autodesk.Measure', MeasureExtension);


