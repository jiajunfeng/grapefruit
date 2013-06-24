/**
 * Loads json data
 *
 * @class JsonLoader
 * @constructor
 */
gf.JsonLoader = function(al, name, url) {
    gf.Loader.call(this, al, name, url);

    this.type = 'json';
};

gf.inherits(gf.JsonLoader, gf.Loader, {
    load: function() {
        //pull from cache
        if(gf.Loader.prototype.load.call(this)) return;

        var self = this,
            baseUrl = this.url.replace(/[^\/]*$/, '');

        gf.utils.ajax({
            method: 'GET',
            url: this.url,
            dataType: 'json',
            load: function(data) {
                var loader;

                //check some properties to see if this is a TiledMap Object
                if(data.orientation && data.layers && data.tilesets && data.version) {
                    loader = new gf.WorldLoader(self.parent, self.name, baseUrl, data);
                }
                //this is a sprite sheet (published from TexturePacker)
                else if(data.frames && data.meta) {
                    loader = new gf.SpriteSheetLoader(self.parent, self.name, baseUrl, data);
                }

                if(loader) {
                    loader.on('load', function(e) {
                        self.done(e.data);
                    });
                    loader.on('error', function(e) {
                        self.error(e.message);
                    });

                    loader.load();
                }
                //just some json data
                else {
                    self.done(data);
                }
            },
            error: function(err) {
                self.error(err.message || err);
            }
        });
    }
});