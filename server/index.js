import koa from 'koa';
import router from 'koa-router';
import handlebars from 'koa-handlebars';
import serve from 'koa-static';
import logger from 'koa-logger';
import fs from 'fs';
import parse from 'co-busboy';
import path from 'path';
import Hashids from 'hashids';
import Locallydb from 'locallydb';
import send from 'koa-send';
import easyimg from 'easyimage';

const routes = router();
const hashids = new Hashids(':simple:image:upload');
const mimes = {
    'image/jpeg': '.jpg',
    'image/pjpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/x-windows-bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'image/x-tiff': '.tiff'
};

routes.get('/', function* home() {
    const images = this.db.collection('images');
    yield this.render('index', {
        title: 'Images',
        images: images.items
    });
});

routes.get('/thumb/:id.:ext', function* thumbGenerator(){
    const images = this.db.collection('images');
    const thumbs = this.db.collection('thumbs');
    const id = hashids.decode(this.params.id);
    const image = images.get(id[0]);

    if (image) {
        const src = `public/images/${image.name}`;
        const path = `public/images/thumbs/${image.name}`;
        let thumb = thumbs.where({ id: image.name }).items;

        if (thumb.length === 0) {
            if (image.mime === 'image/svg+xml') {
                // just copy file
                fs.createReadStream(src)
                  .pipe(fs.createWriteStream(path));
            } else if (image.mime === 'image/gif') {
                yield easyimg.resize({
                    src,
                    dst: path,
                    height: 100,
                    width: 100,
                    gravity: 'center',
                    quality: 80
                });
            } else {
                yield easyimg.thumbnail({
                    src,
                    dst: path,
                    height: 100,
                    width: 100,
                    gravity: 'center',
                    quality: 80
                });
            }

            thumbs.insert({
                src,
                path,
                id: image.name
            });
        }


        yield send(this, path, {
            maxage: 31536000
        });

    } else {
        this.status = 404;
        this.body = 'image not found';
    }

});

routes.get('/:id.:ext', function* imageStatic() {
    const images = this.db.collection('images');
    const id = hashids.decode(this.params.id);
    const image = images.get(id[0]);

    if (image) {
        const path = `public/images/${image.name}`;
        if (this.params.ext === 'json') {
            this.body = Object.assign({}, image, yield easyimg.info(path));
        } else {
            images.update(id[0], { views: (image.views || 0) + 1 });
            yield send(this, path, {
                maxage: 31536000
            });
        }
    } else {
        this.status = 404;
        this.body = 'image not found';
    }
});

routes.get('/:id', function* imageView() {
    const images = this.db.collection('images');
    const id = hashids.decode(this.params.id);
    const image = images.get(id[0]);

    images.update(id[0], { views: (image.views || 0) + 1 });
    yield this.render('image', {
        title: `Image: ${image.id}`,
        image
    });
});

routes.post('/file-upload', function* fileUpload() {
    // multipart upload
    const parts = parse(this);
    const filenames = [];
    const images = this.db.collection('images');
    let part;

    while ((part = yield parts)) {
        if (!part.length) {
            if (mimes[part.mimeType]) {
                const id = hashids.encode(images.header.lcid + 1);
                const filename = id + mimes[part.mimeType];
                const stream = fs.createWriteStream(path.join('public/images/', filename));
                part.pipe(stream);
                filenames.push(filename);
                images.insert({
                    id,
                    name: filename,
                    mime: part.mimeType
                });

                images.save();
            } else {
                this.status = 415;
                break;
            }
        }
    }

    this.body = {
        filenames
    };
});

const app = koa();

app.use(logger());

app.use(function* setDB(next) {
    this.db = new Locallydb('./maindb');

    yield next;
});

app.use(handlebars({
    defaultLayout: 'main',
    root: 'server',
    cache: false
}));

app.use(routes.routes())
    .use(routes.allowedMethods());

app.use(serve('public', {
    maxage: 31536000
}));

app.listen(3000);
