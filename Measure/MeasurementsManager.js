
    var MeasureCommon = Autodesk.Viewing.MeasureCommon; //These come from main lmv bundle.

    // /** @constructor */
    export function MeasurementsManager(viewer)
    {   
        this.viewer = viewer;
        this.init();

        this.restoredMeasurementData = [];
    }

    var proto = MeasurementsManager.prototype;

    proto.getCurrentMeasurement = function() {
        return this.currentMeasurement;
    };

    proto.getRestoredMeasurementData = function() {
        return this.restoredMeasurementData.slice();
    };

    proto.selectMeasurementById = function(id) {
        var measurement = this.measurementsList[id];
        
        if (measurement) {
            this.changeCurrentMeasurement(measurement);
            return this.currentMeasurement;    
        }

        return false;
    };

    proto.createMeasurement = function(measurementType, options) {
        var id = this.measurementsCounter;
        var measurement = new MeasureCommon.Measurement(measurementType, id, options);
        this.measurementsList[id] = measurement;
        this.measurementsCounter++;
        this.changeCurrentMeasurement(measurement);
        return this.currentMeasurement;
    };

    // Renders measurements from data.
    proto.createMeasurementFromData = function(measurementData, measurementType, createIndicatorCb, preparePicksCb) {
        // Convert optional values from DWF to local coordinate
        let options = measurementData.options;
        if (options) {
            // Deep clone options
            options = JSON.parse(JSON.stringify(options));

            // Convert global world coordinats to LMV coordinates
            const model =
                Object.prototype.hasOwnProperty.call(options, 'modelId') && options.modelId
                    ? this.viewer.impl.findModel(options.modelId)
                    : this.viewer.model;
            const globalOffset = model && model.getData().globalOffset;
            if (globalOffset && (globalOffset.x !== 0 || globalOffset.y !== 0 || globalOffset.z !== 0)) {
                const cvtPts = points => {
                    if (points) {
                        for (let i = 0; i < points.length; ++i) {
                            // Tricky way to use Vector3 sub on plain objects
                            THREE.Vector3.prototype.sub.call(points[i], globalOffset);
                        }
                    }
                };
                cvtPts(options.dimensionOffset);
                cvtPts(options.dashedLeader);
                cvtPts(options.arc);
            }
        }

        this.createMeasurement(measurementType, options);
        if (createIndicatorCb instanceof Function) {
            createIndicatorCb(this.currentMeasurement);
        }

        this.initPicks(measurementData.picks);

        if (preparePicksCb instanceof Function) {
            preparePicksCb();
        }

        if (this.currentMeasurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_AREA) {
            this.currentMeasurement.closedArea = true;
        } else if (this.currentMeasurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_CALLOUT) {
            this.currentMeasurement.text = measurementData.text;
        }

        const preparePointData = () => {
            const points = this.restoredMeasurementData[this.currentMeasurement.id];
            const keys = Object.keys(points);
            const data = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const pointData = points[key];
                data[key] = {
                    intersection: pointData.intersection,
                    circularArcRadius: pointData.circularArcRadius,
                    circularArcCenter: pointData.circularArcCenter,
                };
            }
            return data;
        };

        this.currentMeasurement.indicator.changeAllEndpointsEditableStyle(true);
        this.currentMeasurement.indicator.enableSelectionAreas(true);
        this.currentMeasurement.indicator.enableLabelsTouchEvents(true);

        this.activatePicks();

        this.currentMeasurement.computeResult(this.currentMeasurement.picks, this.viewer);

        // This will render the measurements
        this.currentMeasurement.indicator.renderFromPoints(preparePointData(), true);

        this.currentMeasurement.indicator.changeAllEndpointsEditableStyle(true);
        this.currentMeasurement.indicator.enableSelectionAreas(true);
        this.currentMeasurement.indicator.enableLabelsTouchEvents(true);

        this.currentMeasurement.isRestored = true;
    };

    // Initializes picks from pick data
    proto.initPicks = function(pickData) {
        if (!pickData) return;
        const points = [];

        for (let i = 0; i < pickData.length; i++) {
            const pick = pickData[i];
            if (!pick) continue;
            const key = i + 1;

            let pickPoint = new THREE.Vector3(pick.intersection.x, pick.intersection.y, pick.intersection.z);
            const model =
                Object.prototype.hasOwnProperty.call(pick, 'modelId') && pick.modelId
                    ? this.viewer.impl.findModel(pick.modelId)
                    : this.viewer.model;

            if (model) {
                const modelData = model.getData();
                pickPoint =
                    modelData && Object.prototype.hasOwnProperty.call(modelData, 'globalOffset')
                        ? pickPoint.sub(modelData.globalOffset).clone()
                        : pickPoint.clone();
            }

            points[key] = {
                intersection: pickPoint,
                viewportId: pick.viewportIndex2d,
                hasTopology: pick.hasTopology,
                modelId: pick.modelId,
                snapNode: pick.snapNode,
                circularArcRadius: pick.circularArcRadius,
                circularArcCenter: pick.circularArcCenter
            };
            this.currentMeasurement.getPick(key);
        }

        this.restoredMeasurementData[this.currentMeasurement.id] = points;
    };

    // Stores information from the restored measurement pick data in the current measurement picks
    proto.activatePicks = function() {
        if (!this.currentMeasurement.picks) return;
        const keys = Object.keys(this.currentMeasurement.picks);

        const id = this.currentMeasurement.id;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            const pick = this.currentMeasurement.picks[key];
            const restoredMeasurements = this.getRestoredMeasurementData();
            const pointInfo = restoredMeasurements[id][key];
            let p = pointInfo.intersection.clone();

            if (!pick.getGeometry() && pointInfo.intersection) {
                pick.geomType = MeasureCommon.SnapType.SNAP_VERTEX;
                pick.geomVertex = p;
                pick.intersectPoint = p;
                pick.modelId = pointInfo.modelId;
                pick.snapNode = pointInfo.snapNode; // the dbid of the pick. This is used for isolation.
                pick.circularArcCenter = pointInfo.circularArcCenter;
                pick.circularArcRadius = pointInfo.circularArcRadius;

                // Set the isRestored flag if all of the picks are valid.
                pick.viewportIndex2d = pointInfo.viewportId;
            }
        }
    };

    proto.changeCurrentMeasurement = function(measurement) {
        this.currentMeasurement = measurement;
        this.viewer.dispatchEvent({ type: MeasureCommon.Events.MEASUREMENT_CHANGED_EVENT, data: { type: measurement.measurementType, id: measurement.id }});
    };

    proto.removeCurrentMeasurement = function() { 
        // Remove current measurement from the list
        if (Object.keys(this.measurementsList).length > 0) {
            delete this.measurementsList[this.currentMeasurement.id];
        }
    };

    proto.init = function() {
        this.reset();
    };

    proto.destroy = function() {
        this.reset();
    };

    proto.reset = function() {
        this.currentMeasurement = null;
        this.measurementsList = {};
        this.measurementsCounter = 0;
    };

