

    "use strict";

    var av = Autodesk.Viewing,
        ave = Autodesk.Viewing.Extensions,
        avp = Autodesk.Viewing.Private,
        avu = Autodesk.Viewing.UI,
        MeasureCommon = Autodesk.Viewing.MeasureCommon;

    // This strange code is there because we 
    // don't want DockingPanel, which is used as a base class later
    // to be undefined during headless mode.
    // Simply deriving from undefined will cause an exception (from babel env preset) 
    // even if the class is never instantiated
    const DockingPanel = (avu && avu.DockingPanel) || class {};
    // et ViewerPanelMixin to a no-op in headless mode
    const ViewerPanelMixin = (ave && ave.ViewerPanelMixin) || function () {};

    const _gWindow = av.getGlobal();
    const _gDocument = _gWindow.document;

    //
    // /** @constructor */
    //
    //
    export var CalibrationPanel = function(calibrationTool, viewer, id, title, options)
    {
        var self = this;

        options = options || {};
        options.addFooter = false;

        DockingPanel.call(this, viewer.container, id, title, options);

        this.viewer = viewer;
        this.calibrationTool = calibrationTool;
        this.parentContainer = viewer.container;
        this.container.style.left = '0px';
        this.container.style.top = '0px';
        this.container.style.resize = 'none';

        this.container.classList.add('calibration-panel');

        this.setGlobalManager && this.setGlobalManager(viewer.globalManager);

        this.addEventListener( this.closer, "click", function(e) {
            self.setVisible(false);
            self.calibrationTool.clearSize();
            self.calibrationTool.showAddCalibrationLabel();
        });

        if (!options.heightAdjustment)
            options.heightAdjustment = 40;
        if (!options.marginTop)
            options.marginTop = 0;
        options.left = false;

        this.createScrollContainer(options);

        const _document = (this.getDocument && this.getDocument()) || _gDocument;

        this.calibrationMenu = _document.createElement("div");

        this.scrollContainer.appendChild( this.calibrationMenu );

        // Table
        this.table = _document.createElement("table");
        this.table.className = "adsk-lmv-tftable calibration-table";
        this.tbody = _document.createElement("tbody");
        this.table.appendChild(this.tbody);
        this.calibrationMenu.appendChild(this.table);

        // Define Size Row
        this.row = this.tbody.insertRow(0);
        this.requestedSizeTextbox = _document.createElement('input');
        this.requestedSizeTextbox.className = 'docking-panel-textbox';
        this.requestedSizeTextbox.type = 'text';
        this.requestedSizeTextbox.autofocus= 'true';

        this.addEventListener(this.requestedSizeTextbox, "keyup", function(e) {
            var value = self.requestedSizeTextbox.value;
            if (value !== "" && value.split(".")[0] === "") {
                self.requestedSizeTextbox.value = "0" + value;
            }
            self.updateLabel();
        });


        this.addEventListener(this.requestedSizeTextbox, "keypress", function(e) {
            var key = e.key || String.fromCharCode(e.keyCode);
            // Handling backspace and arrows for firefox
            if (key == "Backspace" || key == "ArrowLeft" || key == "ArrowRight"){
                return;
            }

            // Escape (For IE11)
            if (e.keyCode == av.KeyCode.ESCAPE) {
                self.setVisible(false);
                self.calibrationTool.clearSize();
                self.calibrationTool.showAddCalibrationLabel();
                return;
            }

            var requestedSize = self.requestedSizeTextbox.value;
            var cursorIndex = self.requestedSizeTextbox.selectionStart;
            requestedSize = [requestedSize.slice(0, cursorIndex), key, requestedSize.slice(cursorIndex)].join('');
            
            if (requestedSize == ".") {
                return;
            }

            var isSimple = self.units[self.unitList.selectedIndex].simpleInput;
        
            if (!isPositiveNumber(requestedSize) || (isSimple && (!isSimpleDecimal(requestedSize) || Autodesk.Viewing.Private.calculatePrecision(requestedSize) > self.calibrationTool.getMaxPrecision()))) {
                    e.preventDefault();
            }
        });

        var caption = "Define Size";
        var cell = this.row.insertCell(0);
        this.caption = _document.createElement("div");
        this.caption.setAttribute("data-i18n", caption);
        this.caption.textContent = av.i18n.translate(caption);
        cell.appendChild(this.caption);

        cell = this.row.insertCell(1);
        cell.appendChild(this.requestedSizeTextbox);

        // Unit Type Row
        this.units = [
            { name: 'Feet and fractional inches', units: 'ft-and-fractional-in', matches: ['ft-and-fractional-in'], simpleInput: false },
            { name: 'Feet and decimal inches', units: 'ft-and-decimal-in', matches: ['ft-and-decimal-in'], simpleInput: false },
            { name: 'Meters', units: 'm', matches: ['m'], simpleInput: true },
            { name: 'Centimeters', units: 'cm', matches: ['cm'], simpleInput: true },
            { name: 'Millimeters', units: 'mm', matches: ['mm'], simpleInput: true }
        ];

        var unitNames = [];
        for (var i = 0; i < this.units.length; ++i) {
            unitNames.push(this.units[i].name);
        }
        this.unitList = new avp.OptionDropDown("Unit type", this.tbody, unitNames, 0, null, { paddingLeft: 0, paddingRight: 15 });
        this.unitList.setGlobalManager(this.globalManager);
        this.addEventListener(this.unitList, "change", function(e) {
            self.updateLabel();
        });

        // Set Calibration button
        var setCalibration = _document.createElement('div');
        setCalibration.classList.add('docking-panel-primary-button');
        setCalibration.classList.add('calibration-button');

        setCalibration.setAttribute("data-i18n", "Set Calibration");
        setCalibration.textContent = av.i18n.translate("Set Calibration");

        setCalibration.addEventListener('click', function () {
            var index = self.unitList.selectedIndex;
            var requestedUnits = self.units[index].units;
            self.calibrationTool.calibrate(requestedUnits, self.requestedSizeTextbox.value);
        }, false);

        this.calibrationMenu.appendChild(setCalibration);
        

    }; // end constructor

    var isPositiveNumber = function (n) {
        // The first character of the string has to be a digit.
        return n.match(/^(\d+)/);
    };

    var isSimpleDecimal = function (n) {
        // Add "0" to the end of the string, to check if there are trailing spaces.
        n += '0';
        return !isNaN(parseFloat(n)) && !isNaN(+n) && parseFloat(n) >= 0;
    };

    CalibrationPanel.prototype = Object.create(DockingPanel.prototype);
    ViewerPanelMixin.call(CalibrationPanel.prototype);


    CalibrationPanel.prototype.uninitialize = function uninitialize() {
        this.viewer = null;
        DockingPanel.prototype.uninitialize.call(this);
    };

    CalibrationPanel.prototype.findUnits = function findUnits() {
        var i,
            j,
            selectedUnits = this.calibrationTool.getCurrentUnits();
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

    CalibrationPanel.prototype.setPanelValue = function(size) {
        this.unitList.setSelectedIndex(this.findUnits());
        this.requestedSizeTextbox.value = size;
    };

    CalibrationPanel.prototype.updateLabel = function() {
        var index = this.unitList.selectedIndex;
        var requestedUnits = this.units[index].units;
        var size = this.requestedSizeTextbox.value;
        var parsedNumber = Autodesk.Viewing.Private.UnitParser.parsePositiveNumber(size, requestedUnits);
        var text = Autodesk.Viewing.Private.formatValueWithUnits(parsedNumber, requestedUnits, 3, Autodesk.Viewing.Private.calculatePrecision(size));

        if (size === "") {
            this.calibrationTool.updateLabelValue(null);
        } else if (!isNaN(parsedNumber)) {
            this.calibrationTool.updateLabelValue(text);
        }
    };

    CalibrationPanel.prototype.updatePanelPosition = function (labelPosition, p1, p2, labelOffset) {

        var width = parseInt(this.container.getBoundingClientRect().width);
        var height = parseInt(this.container.getBoundingClientRect().height);

        var cornerX;
        var cornerY;

        if (!labelPosition || !p1 || !p2) {
            cornerX = Math.floor((this.viewer.canvas.clientWidth - width) / 2);
            cornerY = Math.floor((this.viewer.canvas.clientHeight - height) / 2);
        }
        else {
            p1 = MeasureCommon.project(p1, this.viewer);
            p2 = MeasureCommon.project(p2, this.viewer);
            var rubberbandDirection = new THREE.Vector2().copy(p1).sub(p2).normalize();

            var normal;
            if (p1.x < p2.x) {
                normal = new THREE.Vector2(rubberbandDirection.y, -rubberbandDirection.x);
            } else {
                normal = new THREE.Vector2(-rubberbandDirection.y, rubberbandDirection.x);
            }

            var offset = labelOffset + Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;

            normal = normal.multiplyScalar(offset);
            var pos =  labelPosition.sub(normal);

            cornerX = pos.x - Math.floor(width / 2);
            cornerY = pos.y - Math.floor(height / 2);

            // if panel exceeds screen bounds, just put the panel in the center of the screen.
            if ((cornerX < 0) || (cornerX + width > this.viewer.canvas.clientWidth) || (cornerY < 0) || (cornerY + height > this.viewer.canvas.clientHeight)) {
                cornerX = Math.floor((this.viewer.canvas.clientWidth - width) / 2);
                cornerY = Math.floor((this.viewer.canvas.clientHeight - height) / 2);
            }
        }

        this.container.style.left = cornerX + 'px';
        this.container.style.top  = cornerY + 'px';
    };

    //
    // /** @constructor */
    //
    //
    export var CalibrationRequiredDialog = function(measureExt, viewer, id, title, options)
    {
        var self = this;

        options = options || {};
        options.addFooter = false;

        DockingPanel.call(this, viewer.container, id, title, options);

        this.viewer = viewer;
        this.measureExt = measureExt;
        this.parentContainer = viewer.container;
        this.container.classList.add('calibration-panel');
        this.container.style.width = "380px";
        this.container.style.height = "190px";
        
        this.setGlobalManager && this.setGlobalManager(viewer.globalManager);

        if (!options.heightAdjustment)
            options.heightAdjustment = 70;
        if (!options.marginTop)
            options.marginTop = 0;
        options.left = false;

        const _document = (this.getDocument && this.getDocument()) || _gDocument;

        this.createScrollContainer(options);
        this.dialogBox = _document.createElement("div");
        this.scrollContainer.appendChild( this.dialogBox );

        // text
        var calibrateNow = _document.createElement('div');
        calibrateNow.className = 'calibration-text';
        var text = "Calibration Message";
        calibrateNow.setAttribute("data-i18n", text);
        calibrateNow.textContent = av.i18n.translate(text);
        this.dialogBox.appendChild(calibrateNow);

        var buttonsWrapper = _document.createElement('div');
        buttonsWrapper.className = 'calibration-buttons-wrapper';
        this.dialogBox.appendChild(buttonsWrapper);
        
        // Cancel button
        var cancel = _document.createElement('div');
        cancel.classList.add('docking-panel-secondary-button');
        cancel.classList.add('calibration-button-left');
        cancel.setAttribute("data-i18n", "Cancel");
        cancel.textContent = av.i18n.translate("Cancel");
        cancel.addEventListener('click', function () {
            self.setVisible(false);
        }, false);
        buttonsWrapper.appendChild(cancel);

        // Calibrate-Now button
        var calibrateNowButton = _document.createElement('div');
        calibrateNowButton.classList.add('docking-panel-primary-button');
        calibrateNowButton.classList.add('calibration-button-right');
        calibrateNowButton.setAttribute("data-i18n", "Calibrate Now");
        calibrateNowButton.textContent = av.i18n.translate("Calibrate Now");
        calibrateNowButton.addEventListener('click', function () {
            self.measureExt.enableCalibrationTool(true);
            self.setVisible(false);
        }, false);
        buttonsWrapper.appendChild(calibrateNowButton);
        

    }; // end constructor

    CalibrationRequiredDialog.prototype = Object.create(DockingPanel.prototype);
    ViewerPanelMixin.call(CalibrationRequiredDialog.prototype);


    CalibrationRequiredDialog.prototype.uninitialize = function uninitialize() {
        this.viewer = null;
        DockingPanel.prototype.uninitialize.call(this);
    };
