import { PATH } from '../paths.js'
import { transform } from './zettelkasten.js'
import { Index, Attachment, Document } from './object.js'

import { Client } from 'minio'
import { createHash } from 'crypto'
import { encode, decode } from '@msgpack/msgpack'

import Mustache from 'mustache'
import YAML from 'yaml'
import fs from 'fs'
import fm from'front-matter'


const CONFIG = YAML.parse(
    fs.readFileSync(PATH.CONFIG, 'utf8'));


function walkSourceDir([root, parent], callback) {
    let base = [root, parent].filter(Boolean).join('/');
    let filenames = fs.readdirSync(base);

    for (let name of filenames) {
        // omit filenames starting with '.' or '_'
        if (name.startsWith(".") || name.startsWith('_')) continue;

        let path = [base, name].join('/');
        let relpath = [parent, name].filter(Boolean).join('/');

        let stat = fs.statSync(path);
        let timestamp = stat.mtimeMs;

        if (stat.isDirectory()) {
            walkSourceDir([root, relpath], callback);
            continue;
        }

        let [extension, short] = bisect(name);
        let context = {
            root,
            name,
            path,
            parent,
            relpath,
            extension,
            short,
            timestamp
        };

        if (callback && callback(context)) {
            break;
        }
    }
}

function bisect(filename) {
    let parts = filename.split('.');
    let extension = parts.length > 1
        ? parts.pop().toLowerCase()
        : '';
    let short = parts.join('.') || filename;

    return [extension, short];
}

function buildMdDocs(index, ctx) /* always return falsy values */ {
    let content = fs.readFileSync(ctx.path, 'utf8');

    let { attributes, body } = fm(content);
    let pathname = [ctx.parent, ctx.short].filter(Boolean).join('/');

    let text = transform.wikilink(body, href => {
        let [path, hash] = href.split('#', 2);
        let [hasExt,] = bisect(path);
        let needle = hasExt ? path : path + '.md';

        // if link is pointing to itself
        // skip linking
        if (!path || needle === ctx.name || needle === ctx.relpath) {
            let path = [ctx.parent, ctx.short].filter(Boolean).join('/');
            let result = [path, hash].filter(Boolean).join('#');

            return [result, ctx.short];
        }

        let displayName, root;

        // if link is 'shortest'
        if (! needle.includes('/')) {
            walkSourceDir([ctx.root], findPath);
        }

        function findPath({ name, short, parent, relpath }) {
            // find the path to this (shortest) link
            // returning true breaks the loop
            if (needle === name) {
                path = relpath;
                root = parent;
                displayName = short;
                return true;
            }
        }

        if (needle.endsWith('.md')) {
            // create link only when
            // it is pointing to a markdown document
            index.linkWith(ctx.relpath, path);
            // truncate link when its referee is found
            if (root) path = [root, displayName].filter(Boolean).join('/');
        }

        let result = [path, hash].filter(Boolean).join('#');
        return [result, displayName];
    });

    index.object[ctx.relpath] =
        new Document(ctx.short, pathname, attributes, text);
}

function buildObject(index, ctx) /* always return falsy values */ {
    if (ctx.extension === 'md') {
        return buildMdDocs(index, ctx);
    }

    let content = fs.readFileSync(ctx.path);
    let shasum = createHash('sha1');

    shasum.update(content);
    let hash = shasum.digest('hex');

    index.object[ctx.relpath] =
        new Attachment(ctx.short, hash, ctx.relpath, ctx.extension);

    // skip writing to file when hash already exists
    // this procedure prevents duplicate files being indexed
    // for multiple times
    let path = `${PATH.OBJECT}/${hash}`;
    if (fs.existsSync(path)) return;

    fs.writeFileSync(path, content);
}

function buildIndex(metadata, vault) {
    let index = new Index(metadata, {});

    if (! fs.existsSync(PATH.INDEX)) {
        // create index if not found
        // or reuse it
        fs.mkdirSync(PATH.OBJECT, { recursive: true });

        walkSourceDir([vault], ctx => {
            buildObject(index, ctx);
        });

        return index;
    }

    let buffer = fs.readFileSync(PATH.INDEX);
    let legacy = decode(buffer);

    walkSourceDir([vault], ctx => {
        let path = ctx.path;
        let entry = legacy.object[path];
        // if no such legacy entry found, continue
        // indexing and writing to object file
        if (! entry) return buildObject(index, ctx);

        // if found, remove the legacy entry
        // the remaining entries are unnecessary and safe for cleanup
        delete legacy.object[path];

        // compare the timestamps to detect modification
        // insert the entry to index if no changes detected
        if (entry["timestamp"] === ctx.timestamp) {
            index.object[path] = entry;
            index.links[path] = legacy.links[path];
        }
    });

    for (let [path, entry] of Object.entries(legacy.object)) {
        if (entry.type === 'Attachment') {
            let hash = legacy.object[path]["hash"];
            // cleanup legacy entries
            fs.rmSync(`${PATH.OBJECT}/${hash}`, { force: true });
        }
    }

    return index;
}

function prepareVault(config) {
    switch (config["type"]) {
    case "minio":
        fs.rmSync(PATH.S3TEMP, { recursive: true, force: true });
        fs.mkdirSync(PATH.S3TEMP);

        let bucket = config["bucket"];
        let prefix = config["prefix"];
        
        let client = new Client(config);
        let stream = client.listObjectsV2(bucket, prefix, true);

        stream.on('data', item => {
            let name = item.name.replace(prefix, '');
            let path = `${PATH.S3TEMP}/${name}`;

            if (name.endsWith('/')) {
                if (! fs.existsSync(path)) fs.mkdirSync(path);
                return;
            }

            stream.pause();
            console.log(item.name);

            client.fGetObject(bucket, item.name, path)
                .catch(err => { throw err })
                .finally(() => stream.resume());
        });

        return new Promise((resolve, reject) => {
            stream.on('close', () => resolve(PATH.S3TEMP));
            stream.on('error', er => reject(er));
        });
    case "file":
        let path = config["path"];

        if (fs.existsSync(path) && fs.lstatSync(path).isDirectory) {
            return new Promise((resolve) => resolve(path));
        }
        throw new Error(path + ": not a valid vault");
    default:
        throw new Error("invalid vault type");
    }
}

if (process.argv[1] === import.meta.filename) {
    // when running under node.js solely
    sprachbund().writeBundle();
}

export default function sprachbund() {
    return {
        name: 'sprachbund',

        transformIndexHtml(html) {
            return Mustache.render(html, {
                name:        CONFIG?.name,
                description: CONFIG?.description,
                language:    CONFIG?.language,
            });
        },
        async writeBundle() {
            let vault = await prepareVault(CONFIG.vault);
            let index = buildIndex(CONFIG.metadata, vault);
            
            fs.writeFileSync(PATH.INDEX, encode(index));
        },
    }
}
