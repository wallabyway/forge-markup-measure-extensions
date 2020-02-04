
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
    }

    proto.selectMeasurementById = function(id) {
        var measurement = this.measurementsList[id];
        
        if (measurement) {
            this.changeCurrentMeasurement(measurement);
            return this.currentMeasurement;    
        }

        return false;
    };

    proto.createMeasurement = function(measurementType) {
        var id = this.measurementsCounter;
        var measurement = new MeasureCommon.Measurement(measurementType, id);
        this.measurementsList[id] = measurement;
        this.measurementsCounter++;
        this.changeCurrentMeasurement(measurement);
        return this.currentMeasurement;
    };

    // Renders measurements from data.
    proto.createMeasurementFromData = function(measurementData, measurementType, createIndicatorCb, preparePicksCb) {
        this.createMeasurement(measurementType);
        if (createIndicatorCb instanceof Function) {
            createIndicatorCb(this.currentMeasurement);
        }

        this.initPicks(measurementData.picks);

        if (preparePicksCb instanceof Function) {
            preparePicksCb();
        }

        if (this.currentMeasurement.measurementType === MeasureCommon.MeasurementTypes.MEASUREMENT_AREA) {
            this.currentMeasurement.closedArea = true;
        }

        this.currentMeasurement.isRestored = true;

        const convertUnits = (value, square) => {
            return Autodesk.Viewing.Private.convertUnits(
                measurementData.sharedUnits,
                this.viewer.model.getUnitString(),
                measurementData.sharedCalibrationFactor,
                parseFloat(value),
                square
            );
        };

        this.currentMeasurement.distanceXYZ = convertUnits(measurementData.distance);
        this.currentMeasurement.distanceX = convertUnits(measurementData.deltaX);
        this.currentMeasurement.distanceY = convertUnits(measurementData.deltaY);
        this.currentMeasurement.distanceZ = convertUnits(measurementData.deltaZ);

        this.currentMeasurement.area = convertUnits(measurementData.area, 'square');
        this.currentMeasurement.angle = parseFloat(measurementData.angle);

        const getIntersectPoints = () => {
            const points = this.restoredMeasurementData[this.currentMeasurement.id];
            const keys = Object.keys(points);
            const intersectPoints = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const pointData = points[key];
                intersectPoints[key] = pointData.intersection;
            }
            return intersectPoints;
        };

        // This will render the measurements
        this.currentMeasurement.indicator.renderFromPoints(getIntersectPoints(), true);

        this.currentMeasurement.indicator.changeAllEndpointsEditableStyle(true);
        this.currentMeasurement.indicator.enableSelectionAreas(true);
        this.currentMeasurement.indicator.enableLabelsTouchEvents(true);

        this.activatePicks();
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
                pick.hasOwnProperty('modelId') && pick.modelId
                    ? this.viewer.impl.findModel(pick.modelId)
                    : this.viewer.model;

            if (model) {
                const modelData = model.getData();
                pickPoint =
                    modelData && modelData.hasOwnProperty('globalOffset')
                        ? pickPoint.add(modelData.globalOffset).clone()
                        : pickPoint.clone();
            }

            points[key] = {
                intersection: pickPoint,
                viewportId: pick.viewportIndex2d,
                hasTopology: pick.hasTopology,
                modelId: pick.modelId
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

