import { PATH } from '../paths.js';
import router from './router.js';

import { decode } from '@msgpack/msgpack'
import { marked } from 'marked'


export class State {
    constructor() {
        this.value = this.init();
    }

    toString() { return this.value }
    
    init() { return '' }
    fail() { return '' }

    async transition(val) {
        try {
            this.value = this.init();
            this.value = await val() ?? this.value;
        } catch (e) {
            console.error(e);
            this.value = this.fail();
        }
    }
}

class BaseObject {
    static fromObject(o) {
        return Object.assign(new this(), o);
    }
}

class BaseNode extends BaseObject {
    constructor(type) {
        super();
        this.type = type;
    }

    fullname() { return this.name }

    static fromObject(o) {
        switch (o?.type) {
            case 'Document':
                return Object.assign(new Document(), o);
            case 'Attachment':
                return Object.assign(new Attachment(), o);
            default:
                throw new Error('invalid type');
        }
    }
}

export class Index extends BaseObject {
    constructor(metadata, object, links = {}) {
        super();
        this.metadata = metadata;
        this.object = object;
        this.links = links;
    }

    static Metadata(x) {
        return {
            hidden: x?.hidden,
            routes: x?.routes,
        }
    }

    static async fromPack() {
        let binary = await fetch(PATH.INDEX);
        let buffer = await binary.arrayBuffer();
        let data = decode(buffer);

        return Index.fromObject(data);
    }

    unflatten() {
        let result = [], level = { result };

        let searchable = [];
        let id = 0;

        let buildWith = (entry) => (r, name, i, a) => {
            if (! r[name]) {
                r[name] = { result: [] };

                if (i !== a.length - 1) {
                    // if this node is a Folder
                    let children = r[name].result;
                    let node = new Folder(name, children);

                    r.result.push(node);
                } else {
                    let node = BaseNode.fromObject(entry);
                    r.result.push(node);

                    if (node.type === 'Document') {
                        node['id'] = id++;
                        searchable.push(node);
                    }
                }
            }
            return r[name];
        }

        for (let [path, entry] of Object.entries(this.object)) {
            path.split('/').reduce(buildWith(entry), level);
        }

        result.sort((a, b) => {
            if (a.type === 'Folder' && b.type !== 'Folder') return -1;
            return a.name.localeCompare(b.name);
        });

        return [result, searchable];
    }

    linkWith(src, target) {
        if (! this.links[target]) this.links[target] = [];
        this.links[target].push(src);
    }

    getObject(path) {
        if (path.startsWith('/')) path = path.slice(1);
        if (!(path in this.object)) path = path + '.md';

        try { var o = BaseNode.fromObject(this.object[path]) }
        catch (e) { return null }

        router.emit('retrieve', { path });
        return o;
    }

    createTree() {
        let [tree, searchable] = this.unflatten();
        let root = new Folder('root', tree);
        let metadata = this.metadata;

        for (let path of metadata.hidden) {
            // find and remove hidden paths
            root.find(path, (parent, i) => parent.splice(i, 1));
        }

        return [root, searchable];
    }
}

export class Folder extends BaseNode {
    constructor(name, children) {
        super('Folder');
        this.name = name;
        this.children = children;
    }

    find(path, callback) {
        let name = path.split('/', 1)[0];
        let next = path.slice(name.length + 1);
        let index = 0;

        for (let child of this.children) {
            if (child.fullname() === name) {
                return child.type === 'Folder' && next
                    ? child.find(next, callback)
                    : callback(this.children, index);
            }
            index += 1;
        }
    }

    render(wrap = true) {
        let html = '';

        for (let node of this.children) {
            if (node.type === 'Folder') {
                html += node.render();
                continue;
            }

            html += `
              <div data-path="/${node.path}" data-active="false"
                   class="flex md:ml-3 ml-0 pl-3 *:w-full select-none border-l
                          data-[active=true]:text-red-600 hover:text-neutral-950 
                          data-[active=true]:border-red-600 hover:border-neutral-800"
              >
                <a class="truncate md:text-base text-lg" href="/${node.path}"
                   @click="navigate = true; router.from($event)"
                >${node.name}</a>
              </div>
            `;
        }

        let base = 24;
        let maxHeight = base * this.children.length;

        if (wrap) return `
          <div x-data="{ open: false }" @notify="open = true">
            <div class="flex items-center gap-1 hover:text-neutral-400 md:justify-normal justify-between md:pr-0 pr-4 select-none cursor-pointer" @click="open = !open">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5" :class="open ? 'rotate-90' : ''">
                <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
              </svg>
              <span class="md:order-last order-first md:text-base text-lg">
                ${this.name}
              </span>
            </div>
            <div x-show="open" style="--max: ${maxHeight}px" class="flex flex-col md:ml-4 ml-1 mb-1 md:pr-0 pr-1.5 overflow-hidden transition-[max-height]"
                 x-transition:enter="ease-out duration-100"
                 x-transition:enter-start="max-h-0"
                 x-transition:enter-end="max-h-[var(--max)]"
                 x-transition:leave="ease-in duration-100"
                 x-transition:leave-start="max-h-[var(--max)]"
                 x-transition:leave-end="max-h-0"
            >${html}</div>
          </div>
        `;

        return `
          <div x-data="{ active: null, navigate: false }"
               x-init="let react = () => {
                           let path = window.location.pathname;

                           active?.setAttribute('data-active', false);
                           active = $el.querySelector(\`[data-path=&quot;\${path}&quot;]\`);
                           active?.setAttribute('data-active', true);

                           if (navigate) return navigate = false;
                           let node = active;

                           if (node) while ((node = node.parentElement) !== $el) {
                               // notify all parent elements on the tree
                               // and cause them to open
                               node.dispatchEvent(new CustomEvent('notify'));
                           }
                           setTimeout(() => active?.scrollIntoView(
                               { behavior: 'smooth', block: 'center' }), 150);
                       };
                       router.on('ready', () => {
                           $nextTick(() => react());
                       });
                       $nextTick(() => react())"
          >${html}</div>
        `;
    }
}

export class Document extends BaseNode {
    constructor(name, path, metadata, content) {
        super('Document');
        this.name = name;
        this.path = encodeURI(path);
        this.metadata = metadata;
        this.content = content;
        this.links = [];
    }

    fullname() {
        return this.name + '.md';
    }

    render() {
        let node = document.querySelector('meta[name="application-name"]');
        let appName = node.content;

        let title = this.metadata.title ?? this.name;
        document.title = `${title} - ${appName}`;

        let sidebar = () => `
          <div class="lg:block hidden 2xl:min-w-80 max-w-72 w-full max-h-screen">
            <div class="flex flex-col fixed gap-y-8 pt-6 2xl:w-80 w-72 select-none">
              <!-- Interactive Graph -->
              <div x-html="graph"></div>
              <!-- Headings list -->
              <div x-data="{ headings: [], hash: decodeURI(window.location.hash) }"
                   x-init="if (! hash) window.scroll(0, 0);
                           $nextTick(() => headings = $refs.page.querySelectorAll(':not([data-type]) > :is(h1, h2, h3, h4, h5, h6)'))"
                   x-show="headings.length > 0"
                   class="mr-8"
               >
                 <div class="uppercase text-sm font-semibold mb-3">On this page</div>
                 <div class="overflow-y-auto overscroll-contain 2xl:max-h-96 max-h-64">
                 <template x-for="heading in headings">
                   <div :data-level="heading.tagName"
                        x-data="{ id: '#' + heading.innerText, scroll: () => heading.scrollIntoView() }"
                        x-init="if (hash === id) scroll()"
                        class="data-[level=H1]:pl-0 data-[level=H1]:border-0 data-[level=H1]:ml-0
                            data-[level=H2]:ml-1 data-[level=H3]:ml-5 data-[level=H4]:ml-9 data-[level=H5]:ml-[3.25rem] ml-[4.25rem]
                            pl-3 border-l"
                    >
                      <a x-text="heading.innerText"
                         class="text-neutral-500 hover:text-neutral-800"
                         :href="id"
                         @click="scroll()"
                      ></a>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        `;

        return `
          <div x-init="$nextTick(() => router.emit('ready'))"
               class="flex flex-col w-full md:mx-12 m-6 md:mt-8" 
          >
            <div class="font-bold text-4xl mb-6">${title}</div>
            <div x-ref="page" class="prose prose-neutral max-w-none w-full
                                     ${this.metadata['no_sidebar'] ? '' : 'md:max-w-prose'}"
            >
              ${marked(this.content)}
            </div>
          </div>
          ${this.metadata['no_sidebar'] ? '' : sidebar()}
        `;
    }

    inline(attributes = {}) {
        let html = marked(this.content);
        let path = this.path;
        let hash;

        if (attributes.hash) {
            path = path + attributes.hash;
            hash = attributes.hash.slice(1);
            html = `
              <div x-init="
                $nextTick(() => {
                    let outer = $el.parentElement;
                    let block = $el.querySelector(&quot;${attributes.hash}&quot;);
                    if (block) return outer.replaceWith(block);

                    let headings = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
                    let list = Array.from($el.children);
                    let head = list.findIndex(e => headings.includes(e.nodeName) && e.innerText === &quot;${hash}&quot;);
                    let next = list.slice(head + 1).findIndex(e => headings.includes(e.nodeName));

                    if (head === -1) return;
                    let nodes = list.slice(head, next === -1 ? undefined : head + next + 1);

                    if (nodes.length !== 0) return outer.replaceWith(...nodes);
                    outer.replaceChildren($el.children);
                })"
              >${html}</div>
            `;
        }

        return `
          <div class="relative border-l-4 border-red-400 my-6 pl-4 pb-1 embed" data-type="embed">
            <div class="absolute top-0 right-0">
              <button @click="router.goto(&quot;${path}&quot;)" class="rounded-md p-1 hover:bg-neutral-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
                  <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                  <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                </svg>
              </button>
            </div>
            <div data-type="embed">
              <div class="font-semibold">
                ${this.name}
              </div>
              ${html}
            </div>
          </div>
        `;
    }
}

export class Attachment extends BaseNode {
    static IMAGE = ['png', 'svg', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'ico', 'cur'];
    static AUDIO = ['mp3', 'aac', 'ogg'];
    static VIDEO = ['mp4', 'webm'];

    constructor(name, hash, path, extension) {
        super('Attachment');
        this.name = name;
        this.hash = hash;
        this.path = encodeURI(path);
        this.extension = extension;
    }

    fullname() {
        return [this.name, this.extension].join('.');
    }

    inline(attributes = {}) {
        let source = `${PATH.OBJECT}/${this.hash}`;
        let type = this.extension, html = '';

        for (let [key, value] of Object.entries(attributes)) {
            html += `${key}="${value}" `;
        }

        if (Attachment.IMAGE.includes(type)) {
            return `
              <img src="${source}" ${html}/>
            `;
        }

        if (Attachment.AUDIO.includes(type)) {
            return `
              <audio src="${source}" type="audio/${type}" ${html}controls></audio>
            `;
        }

        if (Attachment.VIDEO.includes(type)) {
            return `
              <video src="${source}" type="video/${type}" ${html}controls></video>
            `;
        }
    }

    render() {
        let html = this.inline();

        let node = document.querySelector('meta[name="application-name"]');
        let appName = node.content;

        let title = this.name;
        document.title = `${title} - ${appName}`;

        if (html) return `
          <div class="flex h-screen w-full justify-center items-center">
            <div class="flex w-10/12 justify-center">${html}</div>
          </div>
        `;

        return `
          <div class="xl:text-9xl lg:text-8xl md:text-7xl text-6xl text-neutral-200 pt-4 pl-6 select-none">
            Unsupported file format.
          </div>
        `;
    }
}
