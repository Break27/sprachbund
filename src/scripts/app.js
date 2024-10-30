import { Engine } from './search'
import { Index, State } from './object'
import router from './router'
import zettelkasten from './zettelkasten'

import { marked } from 'marked'


export default () => ({
    router,
    index: null,

    navigation: new class extends State {
        toString() {
            return `
              <div class="flex flex-col size-full px-5 pt-3 pb-8 text-neutral-600">
                ${this.value}
              </div>
            `;
        }

        fail() {
            return `
              <div class="flex size-full justify-center items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-24 text-neutral-200">
                  <path fill-rule="evenodd" d="m5.965 4.904 9.131 9.131a6.5 6.5 0 0 0-9.131-9.131Zm8.07 10.192L4.904 5.965a6.5 6.5 0 0 0 9.131 9.131ZM4.343 4.343a8 8 0 1 1 11.314 11.314A8 8 0 0 1 4.343 4.343Z" clip-rule="evenodd" />
                </svg>
              </div>
            `;
        }
    },

    search: new class extends State {
        constructor() {
            super();
            this.engine = Engine.Default();
        }

        toString() {
            return this.engine.template('search.engine');
        }
    },

    content: new class extends State {
        init() {
            return `
              <div class="flex size-full justify-center self-center">
                <svg class="animate-spin size-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            `;
        }

        fail() {
            return `
              <div class="xl:text-9xl lg:text-8xl md:text-7xl text-6xl text-neutral-200 pt-4 pl-6 select-none">
                An unexpected error occurred.
              </div>
            `;
        }

        fallback() {
            this.value = `
              <div class="flex size-full justify-center self-center">
                <div class="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-24 text-neutral-200">
                    <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clip-rule="evenodd" />
                  </svg>
                  <div class="font-semibold">
                    NOT FOUND
                  </div>
                </div>
              </div>
            `;
        }
    },

    graph: new class extends State {
        toString() {
            return `
              <div class="uppercase text-sm font-semibold mb-3">Interactive graph</div>
              <div x-data="{ expand: false,
                             anchor: $el.parentElement,
                             remove: () => $el.remove(),
                             collapse: () => { $data.expand = false;
                                               $data.anchor.appendChild($el);
                                               $data.toggleGlobal(false);
                                             },
                             toggleGlobal: (value) => router.emit('graphview toggle global', { value })
                           }"
                   x-effect="if (expand) document.querySelector('body').firstElementChild.appendChild($el)"
                   :class="expand ? 'fixed flex size-full max-h-screen py-10 px-24 z-50' : '2xl:size-72 size-64'"
              >
                <div class="relative rounded-md border size-full p-1 bg-white"
                     x-data="{ ready: false }"
                     x-init="if (graph.value?.nodeType) { ready = true; $el.appendChild(graph.value) }"
                     @click="if ($el.children.length < 4) { remove(); toggleGlobal(false) }"
                >
                  <template x-if="ready">
                    <div class="flex items-center gap-x-1 mr-1 mt-1 absolute top-0 right-0 z-20 text-neutral-600">
                      <button x-show="expand" class="hover:text-red-500" @click="collapse()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                      <button x-show="!expand" class="hover:text-red-500" @click="expand = true; toggleGlobal(true)">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
                          <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                        </svg>
                      </button>
                      <button x-show="!expand" class="hover:text-red-500" @click="expand = true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                          <path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </template>
                  <template x-if="!ready">
                    <div x-html="graph.value" class="size-full">
                    </div>
                  </template>
                </div>
                <template x-if="expand">
                  <div class="absolute inset-0 size-full bg-neutral-400 opacity-25 -z-20" @click="collapse()">
                  </div>
                </template>
              </div>
            `;
        }

        init() {
            return `
              <div class="flex size-full justify-center items-center">
                <svg class="animate-spin size-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            `;
        }

        fail() {
            return `
              <div class="flex size-full justify-center items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-24 text-neutral-200">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
                </svg>
              </div>
            `;
        }
    },

    init() {
        this.content.transition(async () => {
            this.index = await Index.fromPack();
            this.content.value = ''; // clear init state

            this.graph.transition(async () => {
                const { Engine } = await import('./graph');

                let engine = Engine.fromIndex(this.index);
                let node = await engine.createInstance();
    
                return node;
            });
    
            this.navigation.transition(() => {
                let [tree, searchable] = this.index.createTree();
                let search = this.search.engine.getInstance();
    
                search.addAllAsync(searchable);
                return tree.render(false);
            });

            this.router.start(this.index.metadata.routes);
        });

        this.router.route = (path) => {
            let view = this.index.getObject(path);

            this.content.value = view?.render();
            return Boolean(view);
        }

        this.router.on('error', () => {
            this.content.fallback();
        });

        marked.use(zettelkasten());
    }
})
