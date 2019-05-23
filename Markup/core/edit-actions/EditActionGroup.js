'use strict';

    /**
     * This class will group actions edit actions that should be executed as a whole.
     * When a group is open actions can be added to it, similar actions will be merged into one during this process.
     * This class is not intended to be used by users, it's a helper class of EditActionManager.
     * @constructor
     */
    export function EditActionGroup() {

        this.actions = [];
        this.closed = true;
    }

    var proto = EditActionGroup.prototype;

    /**
     *
     * @returns {boolean}
     */
    proto.open = function() {

        if(!this.closed) {
            return false;
        }

        this.closed = false;
        return true;
    };

    /**
     *
     * @returns {boolean}
     */
    proto.close = function() {

        if (this.closed) {
            return false;
        }

        this.closed = true;
        return true;
    };

    /**
     *
     * @returns {number} targetId
     */
    proto.undo = function() {

        var actions = this.actions;
        var actionsMaxIndex = actions.length - 1;

        var targetId = -1;
        for(var i = actionsMaxIndex; i >= 0; --i) {

            var action =  actions[i];
            action.undo();

            if (action.targetId !== -1) {
                targetId = action.targetId;
            }
        }

        return targetId;
    };

    /**
     *
     * @returns {number} targetId
     */
    proto.redo = function() {

        var actions = this.actions;
        var actionsCount = actions.length;

        var targetId = -1;
        for(var i = 0; i < actionsCount; ++i) {

            var action =  actions[i];
            action.redo();

            if (action.targetId !== -1) {
                targetId = action.targetId;
            }
        }

        return targetId;
    };

    /**
     *
     * @returns {boolean}
     */
    proto.isOpen = function() {

        return !this.closed;
    };

    /**
     *
     * @returns {boolean}
     */
    proto.isClosed = function() {

        return this.closed;
    };

    /**
     *
     * @returns {boolean}
     */
    proto.isEmpty = function() {

        return this.actions.length === 0;
    };

    /**
     *
     * @param {EditAction} action
     */
    proto.addAction = function(action) {

        if (this.closed) {
            return false;
        }

        this.actions.push(action);
        this.compact();

        return true;
    };

    /**
     * @private
     */
    proto.compact = function() {

        var actions = this.actions;
        var actionsCount = actions.length;

        for(var i = 0; i < actionsCount; ++i) {

            // If an action does nothing, remove it.
            var actionA = actions[i];
            if (actionA.isIdentity()) {
                actions.splice(i, 1);
                --actionsCount;
                --i;
                continue;
            }

            // If an action can be merged, merge it.
            for (var j = i + 1; j < actionsCount; ++j) {

                var actionB = actions[j];
                if (actionA.type === actionB.type &&
                    actionA.merge(actionB)) {
                    actions.splice(j, 1);
                    --actionsCount;
                    --i;
                    break;
                }
            }
        }
    };

    proto.getTargetId = function() {
      var actions = this.actions;
      var actionsCount = actions.length;
      var targetId = -1;
      for(var i = 0; i < actionsCount; ++i) {
        var action =  actions[i];
        if (action.targetId !== -1) {
          targetId = action.targetId;
        }
      }
      return targetId;
    }