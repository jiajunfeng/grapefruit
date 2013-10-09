var Container = require('../display/Container'),
    Vector = require('../math/Vector'),
    Polygon = require('../geom/Polygon'),
    Ellipse = require('../geom/Ellipse'),
    Rectangle = require('../geom/Rectangle'),
    utils = require('../utils/utils'),
    inherit = require('../utils/inherit'),
    math = require('../math/math');

/**
 * Tiled object group is a special layer that contains entities
 * TODO: This is all trash
 *
 * @class ObjectGroup
 * @extends Container
 * @constructor
 * @param group {Object} All the settings for the layer
 */
 var ObjectGroup = module.exports = function(map, group) {
    Container.call(this, group);

    /**
     * The map instance this object group belongs to
     *
     * @property map
     * @type Tilemap
     */
    this.map = map;

    /**
     * The game instance this object group belongs to
     *
     * @property game
     * @type Game
     */
    this.game = map.game;

    /**
     * The state instance this object group belongs to
     *
     * @property state
     * @type Game
     */
    this.state = map.state;

    /**
     * The name of the group
     *
     * @property name
     * @type String
     * @default ''
     */
    this.name = group.name || '';

    /**
     * The color to display objects in this group
     *
     * @property color
     * @type
     */
    this.color = group.color;

    /**
     * The user-defined properties of this group. Usually defined in the TiledEditor
     *
     * @property properties
     * @type Object
     */
    this.properties = group.properties || {};

    /**
     * The objects in this group that can be spawned
     *
     * @property objects
     * @type Array
     */
    this.objects = group.objects;

    //translate some tiled properties to our inherited properties
    this.type = group.type;
    this.alpha = group.opacity;
    this.visible = group.visible;
};

inherit(ObjectGroup, Container, {
    /**
     * Spawns all the entities associated with this layer, and properly sets their attributes
     *
     * @method spawn
     * @return {ObjectGroup} Returns itself for chainability
     */
    spawn: function() {
        var game = this.game; //this.Tilemap.GameState.Game

        //we go through these backwards so that things that are higher in the
        //list of object gets rendered on top.
        for(var i = this.objects.length - 1; i >= 0; --i) {
            var o = this.objects[i],
                props = utils.parseTiledProperties(o.properties) || {},
                set,
                interactive,
                obj;

            props.tileprops = {};

            //create a sprite with that texture
            if(o.gid) {
                set = this.parent.getTileset(o.gid);

                if(set) {
                    props.texture = set.getTileTexture(o.gid);
                    props.tileprops = set.getTileProperties(o.gid);

                    //if no hitArea then use the tileset's if available
                    if(!props.hitArea) {
                        if(props.tileprops.hitArea)
                            props.hitArea = props.tileprops.hitArea;
                        else
                            props.hitArea = set.properties.hitArea;
                    }
                }
            }
            //non-sprite object (usually to define an "area" on a map)
            else {
                if(!props.hitArea) {
                    //define a hitArea
                    if(o.polyline)
                        props.hitArea = this._getPolyline(o);
                    else if(o.polygon)
                        props.hitArea = this._getPolygon(o);
                    else if(o.ellipse)
                        props.hitArea = this._getEllipse(o);
                    else
                        props.hitArea = this._getRectangle(o);
                }
            }

            o.name = o.name || props.name || props.tileprops.name;
            o.type = o.type || props.type || props.tileprops.type;

            //a manually specified string texture
            if(typeof props.texture === 'string') {
                props.texture = game.cache.getTexture(props.texture);
            }

            //just a regular DisplayObject
            if(!props.texture) {
                obj = new Container();

                obj.width = o.width;
                obj.height = o.height;
                obj.name = o.name;
                obj.type = o.type;
                obj.hitArea = props.hitArea;
                obj.rotation = o.rotation;
                obj.sensor = true;

                //these are treated as sensor bodies, so always enable physics
                obj.setPosition(o.x, o.y);
                obj.enablePhysics(game.physics);
                if(this.parent._showPhysics)
                    obj.showPhysics();
            } else {
                //some variable for the user if they want them
                //these will be passed through to a custom sprite if wanted
                props.width = o.width;
                props.height = o.height;
                props.zIndex = this.zIndex;

                obj = game.spritepool.create(o.name, props.texture, props);

                //assign some values
                obj.name = o.name;
                obj.type = o.type;
                obj.hitArea = props.hitArea;
                obj.mass = props.mass || props.tileprops.mass;
                obj.inertia = props.inertia || props.tileprops.inertia;
                obj.friction = props.friction || props.tileprops.friction;
                obj.sensor = props.sensor || props.tileprops.sensor;
                obj.setPosition(o.x, o.y);

                var a = props.anchor || props.tileprops.anchor;
                obj.anchor.y = a ? a[1] : 1;
                obj.anchor.x = a ? a[0] : (this.parent.orientation === 'isometric' ? 0.5 : 0);

                if(props.mass || props.tileprops.mass) {
                    obj.enablePhysics(game.physics);

                    if(this.parent._showPhysics)
                        obj.showPhysics();
                }

                if(props.tileprops) {
                    if(props.tileprops.flippedX) {
                        obj.scale.x = -1;
                        obj.anchor.x = a ? a[0] : 1;
                    }

                    if(props.tileprops.flippedY) {
                        obj.scale.y = -1;
                        obj.anchor.y = a ? a[1] : 0;
                    }

                    //IDK if this is right
                    if(props.tileprops.rotatedCW) {
                        obj.rotation = math.degreesToRadians(45);
                    }
                }

                if(props.animation || props.tileprops.animation) {
                    if(obj.goto) {
                        obj.goto(0, props.animation || props.tileprops.animation).play();
                    }
                }

                //set some more stuffz
                if(typeof o.rotation === 'number')
                    obj.setRotation(o.rotation);
            }

            //visible was recently added to Tiled, default old versions to true
            obj.visible = o.visible !== undefined ? !!o.visible : true;

            if(this.parent.orientation === 'isometric') {
                var toTileX = o.x / this.parent.tileSize.x,
                    toTileY = o.y / this.parent.tileSize.y;

                //This cannot be the simplest form of this...
                o.x = (toTileX * this.parent.tileSize.x) - ((toTileY - 1) * (this.parent.tileSize.x / 2));
                o.y = (toTileY * this.parent.tileSize.y / 2) + (toTileX * this.parent.tileSize.y);
            }

            interactive = this._getInteractive(set, props);

            //pass through all events
            if(interactive) {
                obj.interactive = interactive;

                obj.click = this.onObjectEvent.bind(this, 'click', obj);
                obj.mousedown = this.onObjectEvent.bind(this, 'mousedown', obj);
                obj.mouseup = this.onObjectEvent.bind(this, 'mouseup', obj);
                obj.mousemove = this.onObjectEvent.bind(this, 'mousemove', obj);
                obj.mouseout = this.onObjectEvent.bind(this, 'mouseout', obj);
                obj.mouseover = this.onObjectEvent.bind(this, 'mouseover', obj);
                obj.mouseupoutside = this.onObjectEvent.bind(this, 'mouseupoutside', obj);
            }

            //set custom properties
            obj.properties = {};
            for(var t in props.tileprops)
                obj.properties[t] = props.tileprops[t];
            for(var k in props)
                if(k !== 'tileprops')
                    obj.properties[k] = props[k];

            obj._objIndex = i;
            this.addChild(obj);
        }

        return this;
    },
    onObjectEvent: function(eventName, obj, data) {
        this.parent.onObjectEvent(eventName, obj, data);
    },
    _getPolygon: function(o) {
        var points = [];
        for(var i = 0, il = o.polygon.length; i < il; ++i) {
            points.push(new Vector(o.polygon[i].x, o.polygon[i].y));
        }

        return new Polygon(points);
    },
    _getPolyline: function(o) {
        var points = [];
        for(var i = 0, il = o.polyline.length; i < il; ++i) {
            points.push(new Vector(o.polyline[i].x, o.polyline[i].y));
        }

        return new Polygon(points);
    },
    _getEllipse: function(o) {
        return new Ellipse(0, 0, o.width, o.height);
    },
    _getRectangle: function(o) {
        return new Rectangle(0, 0, o.width, o.height);
    },
    _getInteractive: function(set, props) {
        //first check the lowest level value (on the tile iteself)
        return props.interactive || //obj interactive
                props.tileprops.interactive || //tile object interactive
                (set && set.properties.interactive) || //tileset interactive
                this.properties.interactive || //layer interactive
                this.parent.properties.interactive; //map interactive
    },
    /**
     * Despawns all the sprites associated with this layer
     *
     * @method despawn
     * @return {ObjectGroup} Returns itself for chainability
     */
    despawn: function() {
        //remove each sprite from the game
        for(var i = this.children.length - 1; i > -1; --i) {
            var c = this.children[i];

            if(c.destroy)
                c.destroy();
        }

        return this;
    },
    destroy: function() {
        this.despawn();
        Container.prototype.destroy.call(this);
    }
});
