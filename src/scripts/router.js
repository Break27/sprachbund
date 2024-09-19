export const Routes = {
    index() {},
    other() {}
}

const Events = [
    /* eventName: [callbacks], */
]

export default {
    react() {
        let url = window.location.pathname;
        if (url === '/') {
            url = encodeURI(Routes.index());
            history.replaceState({}, '', url);
        } else {
            Routes.other(decodeURI(url));
        }
        this.emit('ready', { url });
    },
    start() {
        window.addEventListener("popstate", () => this.react());
        this.react();
    },
    from(event) {
        event.preventDefault();
        this.goto(event.target.href, '');
    },
    goto(url, base = '/') {
        if (! url) throw new Error('invalid path: ', url);
        history.pushState({}, '', base + url);
        this.react();
    },
    emit(event, params) {
        Events[event]?.forEach(fn => fn(params));
    },
    on(event, callback) {
        if (! Events[event]) Events[event] = [];
        Events[event]?.push(callback);
    }
}
