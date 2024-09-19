export default () => {
    return {
        renderer,
        extensions: [comment(), block()]
    }
}

export const renderer = {
    link({ href, text }) {
        try { var external = new URL(href).href }
        catch (e) {}

        if (external) {
            return `
              <span class="inline-flex gap-0.5">
                <a href="${external}" target="_blank" rel="noopener noreferrer">${text}</a>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-3.5 text-neutral-400 mt-2.5">
                  <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clip-rule="evenodd" />
                  <path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clip-rule="evenodd" />
                </svg>
              </span>
            `;
        }

        return `
          <a href="${href}" @click="router.from($event)">${text}</a>
        `;
    },
    image({ href, text }) {
        try { var external = new URL(href).href }
        catch (e) {}

        let attrs = {};
        let [width, height] = text.split('x', 2);

        if (! height) height = width;
        if (! isNaN(parseInt(width))) attrs = { width, height };

        if (external) {
            return `
              <img src="${href}"
                ${attrs.width  ? 'width="'  + width  + '"' : ''}
                ${attrs.height ? 'height="' + height + '"' : ''}
              />
            `;
        }

        let url = new URL(href, window.location.origin);
        if (url.hash) attrs.hash = url.hash;

        return `
          <div x-data='{ target: null, attrs: ${JSON.stringify(attrs)} }'
               x-init="target = index.getObject(&quot;${decodeURI(url.pathname)}&quot;)"
               x-html="target?.inline(attrs) ?? $el.innerHTML"
          >
            <a href="${url.href}" @click="router.from($event)">${text}</a>
          </div>
        `;
    },
    blockquote({ raw, text, tokens }) {
        // try matching callouts
        let rule = /^ {0,3}> ?\[!(.+)\](-?)([^\n]*)/;
        let match = rule.exec(raw);

        if (! match) {
            let body = this.parser.parse(tokens);
            return `<blockquote>\n${body}</blockquote>\n`;
        }

        let type = match[1].trim().toLowerCase();
        let foldable = Boolean(match[2]);
        let title = match[3].trim();
        let style = getCalloutStyle(type);

        if (tokens.length > 1) {
            tokens.shift();
        } else {
            let trim = text.slice(text.indexOf('\n'));
            tokens[0].tokens[0].text = trim;
        }

        if (tokens[0].tokens?.length > 1) {
            tokens[0].tokens.shift();
        }

        return `
          <div class="rounded px-4 py-2 my-6 ${style.background}"
                x-data="{ open: ${!foldable} }"
                data-callout="${type}"
          >
            <div class="inline-flex items-center w-full gap-x-1.5 px-2
                        ${style.text} ${foldable ? 'cursor-pointer select-none' : ''}"
                  @click="if (${foldable}) open = !open"
            >
              <span>${style.icon}</span>
              <span class="font-semibold">${title}</span>
              <span class="${foldable ? 'transition' : 'hidden'}" :class="open ? 'rotate-90' : ''">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                  <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                </svg>
              </span>
            </div>
            <div x-show="open" class="overflow-hidden transition-[max-height]"
                  x-init="$el.style.setProperty('--max', $el.offsetHeight + 'px')"
                  x-transition:enter="ease-out duration-200"
                  x-transition:enter-start="max-h-0"
                  x-transition:enter-end="max-h-[var(--max)]"
                  x-transition:leave="ease-in duration-200"
                  x-transition:leave-start="max-h-[var(--max)]"
                  x-transition:leave-end="max-h-0"
            >
              ${this.parser.parse(tokens)}
            </div>
          </div>
        `;
    }
}

export const transform = {
    wikilink(src, callback) {
        let rule = /(!)?\[\[([^\]]+)\]\]/;

        let markdown = '';
        let match = [];
        let start = 0;

        while (match = rule.exec(src.slice(start))) {
            let raw = match[0];
            let isEmbed = match[1] ?? '';
            let [href, text] = match[2].trim().split('|', 2);
            let [path, displayName] = callback(href);

            let bound = start + match.index;
            let display = text ?? displayName ?? path;
            
            let head = src.slice(start, bound);
            let tail = isEmbed + `[${display}](/${encodeURI(path)})`;

            markdown += head + tail;
            start = bound + raw.length;
        }

        return markdown + src.slice(start);
    },
}

function comment() {
    return {
        name: 'comment',
        level: 'inline',

        start(src) {
            return src.match(/%%/)?.index;
        },
        tokenizer(src, tokens) {
            let rule = /^%%([\s\S]+?)%%/;
            let match = rule.exec(src);

            if (match) return {
                type: 'comment',
                raw: match[0],
                text: match[1]
            }
        },
        renderer(token) {
            return '';
        }
    }
}

function block() {
    return {
        name: 'block',
        level: 'block',

        start(src) {
            return src.match(/\^/)?.index;
        },
        tokenizer(src, tokens) {
            let rule = /^\^(\S+)/;
            let match = rule.exec(src);

            if (match) return {
                type: 'block',
                raw: match[0],
                id: match[1],
                tokens: [tokens.pop()]
            }
        },
        renderer({ id, tokens }) {
            let body = this.parser.parse(tokens);
            return `<div id="${id}">${body}</div>`;
        }
    }
}

function getCalloutStyle(type) {
    let icon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
      </svg>
    `;
    let background = 'bg-sky-100';
    let text = 'text-blue-500';

    if (type === 'note') {
        return { icon, background, text };
    }

    if (type === 'info') {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
        `;
        return { icon, background, text };
    }

    if (type === 'todo') {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        `;
        return { icon, background, text };
    }

    
    if (type === 'bug') {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0 1 12 12.75Zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 0 1-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 0 0 2.248-2.354M12 12.75a2.25 2.25 0 0 1-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 0 0-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 0 1 .4-2.253M12 8.25a2.25 2.25 0 0 0-2.248 2.146M12 8.25a2.25 2.25 0 0 1 2.248 2.146M8.683 5a6.032 6.032 0 0 1-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0 1 15.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 0 0-.575-1.752M4.921 6a24.048 24.048 0 0 0-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 0 1-5.223 1.082" />
          </svg>
        `;
        let background = 'bg-rose-100';
        let text = 'text-red-500';
        return { icon, background, text };
    }

    if (type === 'example') {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        `;
        let background = 'bg-violet-100';
        let text = 'text-violet-500';
        return { icon, background, text };
    }

    if (['abstract', 'summary', 'tldr'].includes(type)) {
        let icon = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
        `;
        let background = 'bg-teal-100';
        let text = 'text-teal-500';
        return { icon, background, text };
    }

    if (['tip', 'hint', 'important'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
          </svg>
        `;
        let background = 'bg-teal-100';
        let text = 'text-teal-500';
        return { icon, background, text };
    }

    if (['success', 'check', 'done'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        `;
        let background = 'bg-green-100';
        let text = 'text-green-500';
        return { icon, background, text };
    }

    if (['question', 'help', 'faq'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
        `;
        let background = 'bg-orange-100';
        let text = 'text-orange-500';
        return { icon, background, text };
    }

    if (['warning', 'caution', 'attention'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        `;
        let background = 'bg-orange-100';
        let text = 'text-orange-500';
        return { icon, background, text };
    }

    if (['failure', 'fail', 'missing'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        `;
        let background = 'bg-rose-100';
        let text = 'text-red-500';
        return { icon, background, text };
    }

    if (['danger', 'error'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
        `;
        let background = 'bg-rose-100';
        let text = 'text-red-500';
        return { icon, background, text };
    }

    if (['quote', 'cite'].includes(type)) {
        let icon = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        `;
        let background = 'bg-neutral-100';
        let text = 'text-neutral-500';
        return { icon, background, text };
    }

    return { icon , background, text };
}
