
    var av = Autodesk.Viewing;
    var avu = Autodesk.Viewing.UI;
    var avp = Autodesk.Viewing.Private;
    var MeasureCommon = Autodesk.Viewing.MeasureCommon;

    // /** @constructor */
    export function MeasureToolbar(measureExtension)
    {
        this.measureExtension = measureExtension;
        this.measureTool = this.measureExtension.measureTool;
        this.viewer = this.measureExtension.viewer;
        this.setGlobalManager(this.viewer.globalManager);
        this.visible = false;
        this.buttonsList = [];
    }

    var proto = MeasureToolbar.prototype;
    av.GlobalManagerMixin.call(MeasureToolbar.prototype);

    proto.init = function() {
        var self = this;

        const _document = this.getDocument();

        // Add Measure tool toolbar to main toolbar
        var toolbar = this.viewer.getToolbar();
        var navigationBar = toolbar.getControl(Autodesk.Viewing.TOOLBAR.NAVTOOLSID);
        var toolbarOptions = {};
        toolbarOptions.index = toolbar.indexOf(navigationBar) + 1;
        this.measureToolbar = new avu.ControlGroup(Autodesk.Viewing.TOOLBAR.MEASURETOOLSID);
        this.measureToolbar.setGlobalManager(this.globalManager);
        toolbar.addControl(this.measureToolbar, toolbarOptions);
    

        // Create a button for the measure simple distance.
        this.measureSimpleDistanceBtn = new avu.Button("toolbar-measureTool-simple-distance");
        this.measureSimpleDistanceBtn.setGlobalManager(this.globalManager);
        this.measureSimpleDistanceBtn.setToolTip("Distance");
        this.measureSimpleDistanceBtn.setIcon("adsk-icon-measure-distance-new");
        this.measureSimpleDistanceBtn.onClick = function() {
            var enable = self.measureSimpleDistanceBtn.getState() !== avu.Button.State.ACTIVE;
            if (enable) {
                self.measureExtension.activate('distance');
            } else {
                self.measureTool.deselectAllMeasurements();
            }
        };

        this.measureToolbar.addControl(this.measureSimpleDistanceBtn);
        this.buttonsList[MeasureCommon.MeasurementTypes.MEASUREMENT_DISTANCE] = this.measureSimpleDistanceBtn;


        // Create a button for the measure Angle.
        this.measureAngleBtn = new avu.Button("toolbar-measureTool-angle");
        this.measureAngleBtn.setGlobalManager(this.globalManager);
        this.measureAngleBtn.setToolTip("Angle");
        this.measureAngleBtn.setIcon("adsk-icon-measure-angle-new");
        this.measureAngleBtn.onClick = function () {
            var enable = self.measureAngleBtn.getState() !== avu.Button.State.ACTIVE;
            if (enable) {
                self.measureExtension.activate('angle');
            } else {
                self.measureTool.deselectAllMeasurements();
            }
        };
        this.measureToolbar.addControl(this.measureAngleBtn);
        this.buttonsList[MeasureCommon.MeasurementTypes.MEASUREMENT_ANGLE] = this.measureAngleBtn;

        if (this.viewer.model && this.viewer.model.is2d()) {
            // Create a button for the measure distance.
            this.measureAreaBtn = new avu.Button("toolbar-measureTool-area");
            this.measureAreaBtn.setGlobalManager(this.globalManager);
            this.measureAreaBtn.setToolTip("Area");
            this.measureAreaBtn.setIcon("adsk-icon-measure-area-new");
            this.measureAreaBtn.onClick = function() {
                var enable = self.measureAreaBtn.getState() !== avu.Button.State.ACTIVE;
                if (enable) {
                    self.measureExtension.activate('area');
                } else {
                    self.measureTool.deselectAllMeasurements();
                }
            };

            this.measureToolbar.addControl(this.measureAreaBtn);
            this.buttonsList[MeasureCommon.MeasurementTypes.MEASUREMENT_AREA] = this.measureAreaBtn;
        }

        // Create a button for the Calibration tool.
        this.calibrationToolBtn = new avu.Button( "toolbar-calibrationTool");
        this.calibrationToolBtn.setGlobalManager(this.globalManager);
        this.calibrationToolBtn.setToolTip("Calibrate");
        this.calibrationToolBtn.setIcon("adsk-icon-measure-calibration");
        this.calibrationToolBtn.onClick = function(e) {
            var enable = self.calibrationToolBtn.getState() !== avu.Button.State.ACTIVE;
            if(enable) {
                self.measureExtension.activate('calibrate');
            } else  {
                self.measureExtension.enableCalibrationTool(false);
            }
        };

        this.measureToolbar.addControl(this.calibrationToolBtn);
        this.buttonsList[MeasureCommon.MeasurementTypes.CALIBRATION] = this.calibrationToolBtn;

        var separator = _document.createElement('div');
        separator.className = 'measure-toolbar-seperator';

        this.measureToolbar.container.appendChild(separator);
        

        // Create a button for the Trash.
        this.deleteBtn = new avu.Button( "toolbar-delete");
        this.deleteBtn.setGlobalManager(this.globalManager);
        this.deleteBtn.setToolTip("Delete measurement");
        this.deleteBtn.setIcon("adsk-icon-measure-trash");
        this.deleteBtn.onClick = function() {
            self.measureExtension.deleteCurrentMeasurement();
        };

        this.measureToolbar.addControl(this.deleteBtn);

        // Create a button for the Settings panel.
        this.settingsBtn = new avu.Button( "toolbar-settings");
        this.settingsBtn.setGlobalManager(this.globalManager);
        this.settingsBtn.setToolTip("Measure settings");
        this.settingsBtn.setIcon("adsk-icon-measure-settings");

        this.settingsControlPanel = _document.createElement('div');
        this.settingsControlPanel.classList.add('docking-panel');
        this.settingsControlPanel.classList.add('docking-panel-container-solid-color-b');
        this.settingsControlPanel.classList.add('measure-settings-popup');
        this.settingsControlPanel.classList.add('hide');

        this.settingsBtn.onClick = function (event) {
            if (this.settingsControlPanel.classList.contains('hide')) {
                this.settingsControlPanel.classList.remove('hide');
                this.setButtonActive(this.settingsBtn);
            }
            else {
                this.settingsControlPanel.classList.add('hide');
                this.setButtonInactive(this.settingsBtn);
            }
        }.bind(this);

        this.measureToolbar.container.appendChild(this.settingsControlPanel);
        this.settingsControlPanel.root = this.settingsBtn;
        this.measureToolbar.addControl(this.settingsBtn);


        // Settings Panel
        this.table = _document.createElement("table");
        this.table.classList.add("adsk-lmv-tftable");
        this.table.classList.add("calibration-table");

        this.tbody = _document.createElement("tbody");
        this.table.appendChild(this.tbody);
        this.settingsControlPanel.appendChild(this.table);

        this.units = [
            { name: 'Unknown', units: '', matches: [''] },                                      // localized in OptionDropDown() call below
            { name: 'Decimal feet', units: 'decimal-ft', matches: ['ft', 'decimal-ft'] },             // localized in OptionDropDown() call below
            { name: 'Feet and fractional inches', units: 'ft-and-fractional-in', matches: ['ft-and-fractional-in'] },         // localized in OptionDropDown() call below
            { name: 'Feet and decimal inches', units: 'ft-and-decimal-in', matches: ['ft-and-decimal-in'] }, // localized in OptionDropDown() call below
            { name: 'Decimal inches', units: 'decimal-in', matches: ['in', 'decimal-in'] },           // localized in OptionDropDown() call below
            { name: 'Fractional inches', units: 'fractional-in', matches: ['fractional-in'] },  // localized in OptionDropDown() call below
            { name: 'Meters', units: 'm', matches: ['m'] },                                     // localized in OptionDropDown() call below
            { name: 'Centimeters', units: 'cm', matches: ['cm'] },                              // localized in OptionDropDown() call below
            { name: 'Millimeters', units: 'mm', matches: ['mm'] },                              // localized in OptionDropDown() call below
            { name: 'Meters and centimeters', units: 'm-and-cm', matches: ['m-and-cm'] },        // localized in OptionDropDown() call below
            { name: 'Points', units: 'pt', matches: ['pt'] }                                    // localized in OptionDropDown() call below
        ];

        var initialIndex = this.findUnits(),
            unitNames = [];
        
        // It is not possible to hide elements in Safari.
        if (av.isSafari() && this.viewer.model.getDisplayUnit()){
            // We will remove the 'Unknown' unit from the units array.
            this.units.shift();
        }
        
        for (var i = 0; i < this.units.length; ++i) {
            unitNames.push(this.units[i].name);
        }

        this.unitList = new avp.OptionDropDown("Unit type", this.tbody, unitNames, initialIndex, null, { paddingLeft: 0, paddingRight: 15 });
        this.unitList.setGlobalManager(this.globalManager);
        this.unitList.addEventListener("change", function(e) {
            var index = self.unitList.selectedIndex;
            var toUnits = self.units[index].units;
            self.measureTool.setUnits(toUnits);
            self.setupPrecision();
            avp.logger.track({ category: 'pref_changed', name: 'measure/units', value: toUnits });
        });

        this.precisionList = new avp.OptionDropDown("Precision", this.tbody, [], -1, null, { paddingLeft: 0, paddingRight: 15 });
        this.precisionList.setGlobalManager(this.globalManager);
        this.precisionList.addEventListener("change", function(e) {
            var index = self.precisionList.selectedIndex;
            self.measureTool.setPrecision(index);
            avp.logger.track({ category: 'pref_changed', name: 'measure/precision', value: index });
        });

        this.isolate = new avp.OptionCheckbox("Isolate measurement", this.tbody, false);
        this.isolate.setGlobalManager(this.globalManager);
        this.isolate.addEventListener("change", function(e) {
            var enable = self.isolate.checked;
            self.measureTool.setIsolateMeasure(enable);
            if (enable) {
                self.measureTool.isolateMeasurement();
            }
            else {
                self.measureTool.clearIsolate();
            }
            avp.logger.track({ category: 'pref_changed', name: 'measure/isolate', value: enable });
        });

        this.setupPrecision();

        this.updateSettingsPanel();

        if (this.viewer.model && this.viewer.model.is2d()) {
            this.isolate.setVisibility(false);
        }

        if (!this.measureExtension.sharedMeasureConfig.units) {
            this.disableUnitOption();
        }
        // Only disable option if the browser is not Safari
        else if (!Autodesk.Viewing.isSafari()){
            this.disableUnitOption(0);  // disable "Unknown" option when the model has units
        }


        // Create a button for 'Done'.
        this.measureDoneBtn = new avu.Button("toolbar-measureTool-done");
        this.measureDoneBtn.setGlobalManager(this.globalManager);
        var doneText = Autodesk.Viewing.i18n.translate('Done');
        this.measureDoneBtn.setToolTip(doneText);
        var cancelLabel = _document.createElement('label');
        cancelLabel.textContent = doneText;
        var btnContainer = this.measureDoneBtn.container;
        btnContainer.appendChild(cancelLabel);
        btnContainer.classList.add('adsk-label-button');
        var iconEle = btnContainer.getElementsByClassName('adsk-button-icon');
        iconEle && iconEle[0] && (iconEle[0].style.display = 'none');

        this.measureDoneBtn.onClick = function() {
            this.measureExtension.exitMeasurementMode();
        }.bind(this);
        this.measureToolbar.addControl(this.measureDoneBtn);

        // this.settingsControlPanel.style.width = this.measureToolbar.container.getBoundingClientRect().width + 'px';
        this.measureToolbar.setVisible(false);

    };

    proto.destroy = function() {

        // If toolbar was open, close it first. Otherwise, we leave ModelTools toolbar in a broken state.
        if (this.visible) {
            this.closeToolbar();
        }

        if (this.measureToolbar) {
            this.measureToolbar.removeFromParent();
            this.measureToolbar = null;
        }
    };

    proto.closeToolbar = function() {

        this.measureExtension.enableMeasureTool(false);
        this.measureExtension.enableCalibrationTool(false);
        this.toggleVisible();

        var toolbar = this.viewer.getToolbar();
        var viewerToolbarContainer = toolbar.container;
        var viewerContainerChildrenCount = viewerToolbarContainer.children.length;
        
        for(var i = 0; i < viewerContainerChildrenCount; ++i) {
            viewerToolbarContainer.children[i].style.display = "";
        }

        var modelTools = toolbar.getControl(av.TOOLBAR.MODELTOOLSID);
        modelTools.addControl(this.measureExtension.measurementToolbarButton, {index: this.measureExtension.measurementToolbarButton.index });
    };

    proto.toggleVisible = function() {
        this.visible = !this.visible;
        this.measureToolbar.setVisible(this.visible);
        if (!this.visible) {
            this.settingsControlPanel.classList.add('hide');
            this.setButtonInactive(this.settingsBtn);
        }
    };

    proto.setButtonActive = function(button) {
        button.setState(avu.Button.State.ACTIVE);
    };

    proto.setButtonInactive = function(button) {
        button.setState(avu.Button.State.INACTIVE);
    };

    proto.deactivateAllButtons = function() {
        for (var key in this.buttonsList) {
            if (this.buttonsList.hasOwnProperty(key)) {
                var button = this.buttonsList[key];
                this.setButtonInactive(button);   
            }
        }
    };

    proto.activateButtonByType = function(measurementType) {
        this.setButtonActive(this.buttonsList[measurementType]);
    };            

    proto.setupPrecision = function() {
        const _document = this.getDocument();
        while (this.precisionList.dropdownElement.lastChild) {
            this.precisionList.dropdownElement.removeChild(this.precisionList.dropdownElement.lastChild);
        }

        var selectedUnits = this.measureTool.getUnits(),
            precisions;

        if (selectedUnits === 'ft-and-fractional-in' || selectedUnits === 'fractional-in') {
            precisions = ['1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64'];
        } else {
            precisions = ['0', '0.1', '0.01', '0.001', '0.0001', '0.00001'];
        }

        for (var i = 0; i < precisions.length; ++i) {
            var elem = _document.createElement('option');
            elem.value = i;
            elem.textContent = precisions[i];
            this.precisionList.dropdownElement.appendChild(elem);
        }

        var selectedIndex = this.measureTool.getPrecision();
        if (precisions.length <= selectedIndex) {
            selectedIndex = precisions.length - 1;
            this.measureTool.setPrecision(selectedIndex);
        }
        this.precisionList.dropdownElement.selectedIndex = selectedIndex;
    };

    proto.findUnits = function() {
        var i,
            j,
            selectedUnits = this.measureTool.getUnits();
        for (i = 0; i < this.units.length; ++i) {
            var matches = this.units[i].matches;
            if (matches) {
                for (j = 0; j < matches.length; ++j) {
                    if (matches[j] === selectedUnits) {
                        return i;
                    }
                }
            }
        }
        return 0;
    };

    proto.disableUnitOption = function( index ) {
        if (index != null) {
            this.unitList.dropdownElement.children[index].style.display = "none";
            if (av.isIE11) {
                // IE11 can't hide <option> elements...
                this.unitList.dropdownElement.children[index].disabled = true;
                this.unitList.dropdownElement.children[index].style.visibility = "hidden";
            }
        } else {  // disable all options
            this.unitList.dropdownElement.disabled = true;
        }
    };

    proto.updateSettingsPanel = function() {
        this.unitList.dropdownElement.selectedIndex = this.findUnits();
        this.precisionList.dropdownElement.selectedIndex = this.measureTool.getPrecision();
        this.setupPrecision();
    };


