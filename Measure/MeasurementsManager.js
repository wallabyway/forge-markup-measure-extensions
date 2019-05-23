
    var MeasureCommon = Autodesk.Viewing.MeasureCommon; //These come from main lmv bundle.

    // /** @constructor */
    export function MeasurementsManager(viewer)
    {   
        this.viewer = viewer;
        this.init();
    }

    var proto = MeasurementsManager.prototype;

    proto.getCurrentMeasurement = function() {
        return this.currentMeasurement;
    };

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

