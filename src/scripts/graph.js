import router from './router'

import { Sigma } from 'sigma'
import Graph from 'graphology'
import random from 'graphology-layout/random'
import ForceSupervisor from 'graphology-layout-force/worker'


export class Engine {
    constructor(graph) {
        this.graph = graph;
        this.layout = null;
        this.instance = null;
    }

    static fromIndex(index) {
        let graph = new Graph();
        let links = Object.entries(index.links);

        for (let [src, targets] of links) {

            let source = index.object[src];

            let label = source?.name ?? src;
            let path  = source?.path ?? src;

            if (! graph.hasNode(src)) {
                graph.addNode(src, { label, path });
            }

            for (let dest of targets) {
                let target = index.object[dest];

                let label = target?.name ?? dest;
                let path  = target?.path ?? dest;

                if (! graph.hasNode(dest)) {
                    graph.addNode(dest, { label, path });
                }

                if (! graph.hasEdge(src, dest)) {
                    graph.addEdge(src, dest);
                }
            }
        }

        random.assign(graph);
        return new Engine(graph);
    }

    async createInstance() {
        let settings = { allowInvalidContainer: true };
        let container = document.createElement('div');

        container.style.width = '100%';
        container.style.height = '100%';

        let nodes = this.graph.nodes().length;
        let delay = nodes * 20;

        this.instance = new Sigma(this.graph, container, settings);
        this.setupInteraction();
        this.setupGraphStyle(delay);

        await new Promise((resolve) => {
            setTimeout(() => resolve(), delay);
        });

        return container;
    }

    setupInteraction() {
        let params = { isNodeFixed: (_, attr) => attr.highlighted };
        this.layout = new ForceSupervisor(this.graph, params);
        this.layout.start();

        // State for drag'n'drop
        let activeNode = null;
        let isDragging = false;

        let preventHop = false;
        let timeout = 100;

        // On mouse down on a node
        //  - we enable the drag mode
        //  - save in the dragged node in the state
        //  - highlight the node
        //  - disable the camera so its state is not updated
        this.instance.on("downNode", (e) => {
            isDragging = true;
            activeNode = e.node;
            this.graph.setNodeAttribute(activeNode, "highlighted", true);

            // prevent hopping to another node
            // when timeout is reached
            preventHop = false;
            setTimeout(() => preventHop = true, timeout);
        });

        // On mouse move, if the drag mode is enabled, we change the position of the draggedNode
        this.instance.getMouseCaptor().on("mousemovebody", (e) => {
            if (!isDragging || !activeNode) return;

            // Get new position of node
            const pos = this.instance.viewportToGraph(e);

            this.graph.setNodeAttribute(activeNode, "x", pos.x);
            this.graph.setNodeAttribute(activeNode, "y", pos.y);

            // Prevent sigma to move camera:
            e.preventSigmaDefault();
            e.original.preventDefault();
            e.original.stopPropagation();
        });

        // On mouse up, we reset the autoscale and the dragging mode
        this.instance.getMouseCaptor().on("mouseup", () => {
            if (activeNode) {
                this.graph.removeNodeAttribute(activeNode, "highlighted");
            }
            isDragging = false;
            activeNode = null;
        });

        // Disable the autoscale at the first down interaction
        this.instance.getMouseCaptor().on("mousedown", () => {
            if (! this.instance.getCustomBBox()) {
                this.instance.setCustomBBox(this.instance.getBBox())
            }
        });

        // hopping - act as an link when not dragged
        this.instance.on('clickNode', e => {
            if (! preventHop) {
                let path = this.graph.getNodeAttribute(e.node, 'path');
                router.goto(path);
            }
            preventHop = false;
        });
    }

    setupGraphStyle(delay) {
        let localNodes = [];
        let localEdges = [];
        let showGlobal = false;

        router.on('graphview toggle global', ({ value }) => {
            showGlobal = value;
            if (value) localEdges = this.graph.edges();
        });

        let event = router.on('retrieve', ({ path }) => {
            let cache = this.instance.nodeDataCache;

            if (!(path in cache)) {
                localNodes = [];
                localEdges = [];
                return;
            }

            let camera = this.instance.getCamera();
            let { x, y } = cache[path];

            // panover currently visited node
            camera.animate({ x, y, ratio: 0.075 }, { easing: "linear", duration: 500 });

            localNodes = this.graph.neighbors(path).concat(path);
            localEdges = localNodes.reduce((r, n) => r.concat(this.graph.edges(n)), []);
        });

        setTimeout(() => event.recall(), delay);

        let activeNodes = [];
        let activeEdges = [];

        this.instance.on('enterNode', e => {
            activeNodes = this.graph.neighbors(e.node) + e.node;
            activeEdges = this.graph.edges(e.node);
            
            this.instance.refresh({
                partialGraph: { edges: activeEdges },
                skipIndexation: true
            });
        });

        this.instance.on('leaveNode', e => {
            activeNodes = [];
            activeEdges = [];

            this.instance.refresh({
                partialGraph: { edges: localEdges },
                skipIndexation: true
            });
        });

        this.instance.setSetting('nodeReducer', (node, data) => {
            data.hidden = !showGlobal && !localNodes.includes(node);
            data.color = activeNodes.includes(node) ? '#e9757c' : '#999';

            return data;
        });

        this.instance.setSetting('edgeReducer', (edge, data) => {
            data.color = activeEdges.includes(edge) ? '#e9757c' : '#999';
            return data;
        });
    }

    dispose() {
        this.layout.kill();
        this.instance.kill();
    }
}
