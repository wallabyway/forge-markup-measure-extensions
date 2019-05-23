
// Maps EditMode id (string) into a contructor/class
var _editModes = {};

class EditModeManager {
    constructor(){
        // nothing //
    }

    register(id, clazz) {
        if (id in _editModes)
            throw new Error(`EditMode with id (${id}) already registered.`);
        
            _editModes[id] = clazz;
    }

    unregister(id) {
        if (id in _editModes)
            delete _editModes[id];
    }

    getClass(id) {
        return _editModes[id] || null;
    }

    getRegistered() {
        var ret = {}
        for (var id in _editModes) {
            if (_editModes.hasOwnProperty(id)) {
                ret[id] = _editModes[id];
            }
        }
        return ret; // shallow copy.
    }
}


export var theEditModeManager =  new EditModeManager();