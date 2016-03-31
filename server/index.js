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

routes.get('/:id.:ext', function* imageStatic() {
    const images = this.db.collection('images');
    const id = hashids.decode(this.params.id);
    const image = images.get(id[0]);

    if (image) {
        if (this.params.ext === 'json') {
            this.body = image;
        } else {
            images.update(id[0], { views: (image.views || 0) + 1 });
            yield send(this, `public/images/${image.name}`, {
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
