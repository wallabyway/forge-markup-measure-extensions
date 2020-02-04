
const av = Autodesk.Viewing;

export var MagnifyingGlass = function(viewer) {

    var _viewer = viewer;
    var _active = false;
    var _names = ["magnifyingGlass"];
    var _priority = 70;
    var _isPressing = false;
    var _radius = 60;
    var _zoom = 2;
    var _offset = 15;
    var _magnifyingGlassCanvas = null;
    var _imageData = null;
    var _imageBuffer = null;
    var _clientX = null;
    var _clientY = null;
    var _needsClear = false;
    var av = Autodesk.Viewing;
    
    this.setGlobalManager(viewer.globalManager);

    this.isActive = function() {

        return _active;
    };

    this.activate = function() {

        _active = true;
        this.updateMagnifyingGlassBinded = this.updateMagnifyingGlass.bind(this);
    };

    this.updateMagnifyingGlass = function() {
        const _window = this.getWindow();
        const _document = this.getDocument();
        if (_needsClear) {
            _magnifyingGlassCanvas && _magnifyingGlassCanvas.classList.remove('visible');
            _needsClear = false;
        }
        else {
            var pixelRatio = _window.devicePixelRatio;
            var diameter = 2 * _radius;
            var normlizedDiameter = diameter * pixelRatio;
            var x = pixelRatio * (_clientX - (_radius  / _zoom));
            var y = pixelRatio * (_clientY - (_radius  / _zoom));
            
            if (!_magnifyingGlassCanvas) {
                _magnifyingGlassCanvas = _document.createElement("canvas");
                _magnifyingGlassCanvas.className = 'magnifying-glass';
                _magnifyingGlassCanvas.width = normlizedDiameter;
                _magnifyingGlassCanvas.height = normlizedDiameter;
                _magnifyingGlassCanvas.style.width = diameter + 'px';
                _magnifyingGlassCanvas.style.height = diameter + 'px';

                // Swap canvas
                _magnifyingGlassCanvas.getContext("2d").translate(0, normlizedDiameter);
                _magnifyingGlassCanvas.getContext("2d").scale(1,-1);

                _viewer.container.appendChild(_magnifyingGlassCanvas);
                _imageData = _magnifyingGlassCanvas.getContext("2d").createImageData(Math.ceil(normlizedDiameter / _zoom), Math.ceil(normlizedDiameter / _zoom));
                _imageBuffer = new Uint8Array(_imageData.data.buffer);
            }

            var ctx = _magnifyingGlassCanvas.getContext("2d");
            
            // Read the pixels from the frame buffer
            var gl = _viewer.canvas.getContext("webgl2") || _viewer.canvas.getContext("webgl") || _viewer.canvas.getContext("experimental-webgl");         
            gl.readPixels(x, _viewer.canvas.height - y - _imageData.height, _imageData.width, _imageData.height, gl.RGBA, gl.UNSIGNED_BYTE, _imageBuffer);
            // Put the pixel into the magnifying context.
            ctx.putImageData(_imageData, 0, 0);
            // Scale the image
            ctx.drawImage(_magnifyingGlassCanvas, 0, 0, _imageData.width, _imageData.height, 0, 0, normlizedDiameter, normlizedDiameter);
            this.setGlassPosition(_magnifyingGlassCanvas, _clientX, _clientY, diameter, _offset); 

            _magnifyingGlassCanvas.classList.toggle('visible', true);
        }
    };

    this.deactivate = function() {
        this.clearMagnifyingGlass();
        _active = false;
    };

    this.getNames = function() {

        return _names;
    };

    this.getName = function() {

        return _names[0];
    };

    this.getPriority = function() {
        return _priority;
    };

    this.setGlassPosition = function(canvas, x, y, diameter, offset) {
            
        // check the left border of canvas
        canvas.style.left = (x - diameter/2) + 'px';

        // check the top border of canvas
        if (y - diameter - offset > 0) {
            canvas.style.top  = (y - diameter - offset) + 'px';    
        }
        else {
            canvas.style.top = (y + offset) + 'px';    
        }
    };

    this.requestUpdate = function() {
        if(!_viewer.hasEventListener(Autodesk.Viewing.RENDER_PRESENTED_EVENT, this.updateMagnifyingGlassBinded)) {
           _viewer.addEventListener(Autodesk.Viewing.RENDER_PRESENTED_EVENT, this.updateMagnifyingGlassBinded, { once: true });
        }
    };

    this.drawMagnifyingGlass = function(clientX, clientY) {
        _clientX = clientX;
        _clientY = clientY;
        _viewer.impl.invalidate(false, false, true);
        this.requestUpdate();
    };

    this.clearMagnifyingGlass = function () {
        _needsClear = true;
        this.requestUpdate();
    };

    this.handlePressHold = function (event) {

        if (av.isTouchDevice()) {
            switch( event.type )
            {
                case "press":
                    _isPressing = true;
                    this.drawMagnifyingGlass(event.canvasX, event.canvasY);
                    break;

                case "pressup":
                    this.clearMagnifyingGlass();
                    _isPressing = false;
                    break;
            }
        }
        return false;

    };

    this.handleGesture = function(event) {

        if (_isPressing && av.isTouchDevice()) {
            switch( event.type )
            {
                case "dragstart":
                    this.drawMagnifyingGlass(event.canvasX, event.canvasY);
                    break;

                case "dragmove":
                    this.drawMagnifyingGlass(event.canvasX, event.canvasY);
                    break;

                case "dragend":
                    this.clearMagnifyingGlass();
                    _isPressing = false;
                    break;

                case "pinchstart":
                    this.drawMagnifyingGlass(event.canvasX, event.canvasY);
                    break;

                case "pinchmove":
                    this.drawMagnifyingGlass(event.canvasX, event.canvasY);
                    break;

                case "pinchend":
                    this.clearMagnifyingGlass();
                    break;
            }
        }

        return false;
    };

    this.handleMouseMove = function (event) {
        return false;
    };

    this.handleWheelInput = function (delta) {
        return false;
    };

    this.handleButtonUp = function (event, button) {
        return false;
    };

};

av.GlobalManagerMixin.call(MagnifyingGlass.prototype);
