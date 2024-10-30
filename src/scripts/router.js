const Routes = {
    index: null,
    error: null
}

const Events = {
    entries: { /* eventName: [callbacks], */ },
    history: [ /* { eventName, params, }, */ ],
}

export default {
    react() {
        let path = decodeURI(window.location.pathname);
        if (path === '/') {
            if (! Routes.index) return;
            history.replaceState({}, '', Routes.index);
            return this.react();
        }

        if (! this.route(path)) {
            if (! Routes.error) this.emit('error');
            else this.goto(Routes.error);
        }

        this.emit('active');
    },
    route(path) {
        return true;
    },
    start(routes) {
        Object.assign(Routes, routes);
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
    emit(eventName, params) {
        Events.history.unshift({ eventName, params });
        Events.history.length = Math.min(Events.history.length, 50);

        Events.entries[eventName]?.forEach(fn => fn(params));
    },
    on(eventName, callback) {
        if (! Events.entries[eventName]) Events.entries[eventName] = [];
        Events.entries[eventName]?.push(callback);

        return {
            recall: () => {
                for (let e of Events.history)
                    if (e.eventName === eventName)
                        return callback(e.params);
            },
            cancel: () => {
                let callbacks = Events.entries[eventName];
                this.on(eventName, () => Events.entries[eventName] = callbacks);
            }
        };
    }
}
