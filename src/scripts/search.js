import MiniSearch from 'minisearch'


const Singleton = {};

export class Engine {
    constructor(options, queryOptions) {
        Singleton.instance = new MiniSearch(options);
        this.queryOptions = queryOptions;
    }

    static Default() {
        let options = {
            fields: ['name', 'content'],
            storeFields: ['name', 'path']
        };

        let queryOptions = {
            prefix: true,
            fuzzy: 0.2
        };

        return new Engine(options, queryOptions);
    }

    template(namespace) {
        return `
          <div x-data="{ value: '', active: false }" class="relative mx-5 mt-6" @focusin="active = true" @focusout="active = false">
            <div class="flex focus-within:ring-2 ring-neutral-300 transition w-full items-center rounded-md border pl-1 py-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 text-neutral-400">
                <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
              </svg>
              <input type="text" x-model="value" class="w-full px-2 placeholder:text-neutral-300 focus:outline-none" placeholder="Search page or heading...">
            </div>
            <div x-show="active && value" class="absolute rounded-md border bg-white left-0 top-0 mt-9 min-w-48 max-h-96 shadow-xl overflow-y-auto overscroll-contain">
              <div x-data="{ results: [] }" x-effect="results = ${namespace}.search(value)" class="empty:hidden flex flex-col p-1.5">
                <template x-for="result in results">
                  <div x-html="${namespace}.generateHTML(result)" class="flex size-full"></div>
                </template>
                <template x-if="results.length === 0">
                  <div class="text-center text-sm text-neutral-600 py-2">
                    No results found.
                  </div>
                </template>
              </div>
            </div>
          </div>
        `;
    }

    generateHTML(result) {
        return `
          <button class="flex flex-col size-full gap-y-1.5 text-start rounded-md hover:bg-neutral-200 p-2"
                  @click="router.goto(&quot;${result.path}&quot;); active = false"
          >
          <span>${result.name}</span>
          <span class="text-xs text-neutral-500"
                x-show="${result.path.includes('/')}"
          >${decodeURI(result.path.split('/').slice(0, -1).join('/'))}</span>
          </button>
        `;
    }

    getInstance() {
        return Singleton.instance;
    }

    search(text) {
        return Singleton.instance.search(text, this.queryOptions);
    }
}
