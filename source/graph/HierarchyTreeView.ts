/**
 * FF Typescript Foundation Library
 * Copyright 2018 Ralph Wiedemeier, Frame Factory GmbH
 *
 * License: MIT
 */

import uniqueId from "@ff/core/uniqueId";

import Component from "@ff/graph/Component";
import CGraph from "@ff/graph/components/CGraph";
import Node from "@ff/graph/Node";
import Graph from "@ff/graph/Graph";
import System from "@ff/graph/System";

import { IHierarchyEvent } from "@ff/graph/components/CHierarchy";
import CSelection, { INodeEvent, IComponentEvent, IActiveGraphEvent } from "@ff/graph/components/CSelection";

import SelectionView, { customElement, html, property } from "./SelectionView";

import "../Button";
import Tree from "../Tree";

////////////////////////////////////////////////////////////////////////////////

@customElement("ff-hierarchy-tree-view")
export default class HierarchyTreeView extends SelectionView
{
    protected tree: HierarchyTree = null;

    constructor(system?: System)
    {
        super(system);

        this.addEventListener("click", this.onClick.bind(this));
        this.addEventListener("contextmenu", this.onContextMenu.bind(this));
    }

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("ff-hierarchy-tree-view");
        this.tree = new HierarchyTree(this.system);
    }

    protected connected()
    {
        super.connected();
        this.selection.selectedComponents.on(CGraph, this.onSelectGraph, this);
        this.selection.on<IActiveGraphEvent>("active-graph", this.onActiveGraph, this);
    }

    protected disconnected()
    {
        super.disconnected();
        this.selection.selectedComponents.off(CGraph, this.onSelectGraph, this);
        this.selection.off<IActiveGraphEvent>("active-graph", this.onActiveGraph, this);
    }

    protected render()
    {
        const selection = this.selection;
        const activeGraphComponent = selection.activeGraph && selection.activeGraph.parent;
        const text = activeGraphComponent ? activeGraphComponent.name || activeGraphComponent.type : "System";

        const down = selection.hasChildGraph() ? html`<ff-button text="down" @click=${this.onClickDown}></ff-button>` : null;
        const up = selection.hasParentGraph() ? html`<ff-button text="up" @click=${this.onClickUp}></ff-button>` : null;

        return html`<div class="ff-flex-row ff-header"><div class="ff-text">${text}</div>${down}${up}</div>
            <div class="ff-scroll-y">${this.tree}</div>`;
    }

    protected onClick()
    {
        this.selection.clearSelection();
    }

    protected onClickUp(event: MouseEvent)
    {
        event.stopPropagation();
        this.selection.activateParentGraph();
    }

    protected onClickDown(event: MouseEvent)
    {
        event.stopPropagation();
        this.selection.activateChildGraph();
    }

    protected onContextMenu()
    {

    }

    protected onSelectGraph(event: IComponentEvent)
    {
        this.requestUpdate();
    }

    protected onActiveGraph(event: IActiveGraphEvent)
    {
        this.requestUpdate();
    }
}

////////////////////////////////////////////////////////////////////////////////

type NCG = Node | Component | Graph;

@customElement("ff-hierarchy-tree")
export class HierarchyTree extends Tree<NCG>
{
    @property({ attribute: false })
    system: System;

    protected selection: CSelection = null;
    protected rootId = uniqueId();


    constructor(system?: System)
    {
        super();
        this.system = system;
    }

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("ff-hierarchy-tree");

        this.selection = this.system.components.safeGet(CSelection);
        this.root = this.selection.activeGraph;
    }

    protected connected()
    {
        super.connected();

        const selection = this.selection;

        selection.selectedNodes.on<INodeEvent>("node", this.onSelectNode, this);
        selection.selectedComponents.on<IComponentEvent>("component", this.onSelectComponent, this);
        selection.on("active-graph", this.onActiveGraph, this);

        selection.system.nodes.on<INodeEvent>("node", this.onUpdate, this);
        selection.system.components.on<IComponentEvent>("component", this.onUpdate, this);
        selection.system.on<IHierarchyEvent>("hierarchy", this.onUpdate, this);
    }

    protected disconnected()
    {
        super.disconnected();

        const selection = this.selection;

        selection.selectedNodes.off<INodeEvent>("node", this.onSelectNode, this);
        selection.selectedComponents.off<IComponentEvent>("component", this.onSelectComponent, this);
        selection.off("active-graph", this.onActiveGraph, this);

        selection.system.nodes.off<INodeEvent>("node", this.onUpdate, this);
        selection.system.components.off<IComponentEvent>("component", this.onUpdate, this);
        selection.system.off<IHierarchyEvent>("hierarchy", this.onUpdate, this);
    }

    protected renderNodeHeader(treeNode: NCG)
    {
        let text;

        if (treeNode instanceof Component) {
            const name = treeNode.name;
            const type = treeNode.type.substr(1);
            const text = name ? `${name} [${type}]` : type;

            if (treeNode instanceof CGraph) {
                return html`<div class="ff-text"><b>${text}</b></div>`;
            }

            return html`<div class="ff-text">${text}</div>`;

        }
        else if (treeNode instanceof Node) {
            const name = treeNode.name;
            const type = treeNode.type;
            if (type === "Node") {
                text = name ? name : type;
            }
            else {
                text = name ? `${name} [${type.substr(1)}]` : type.substr(1);
            }

            return html`<div class="ff-text">${text}</div>`;
        }
        else {
            const text = treeNode.parent ? treeNode.parent.type : "System";
            return html`<div class="ff-text">${text}</div>`;
        }
    }

    protected isNodeSelected(treeNode: NCG)
    {
        const selection = this.selection;
        if (treeNode instanceof Component) {
            return selection.selectedComponents.contains(treeNode);
        }
        else if (treeNode instanceof Node) {
            return selection.selectedNodes.contains(treeNode);
        }
        return false;
    }

    protected getId(node: NCG)
    {
        return node instanceof Graph ? this.rootId : node.id;
    }

    protected getClasses(node: NCG)
    {
        if (node instanceof Node) {
            return "ff-node";
        }
        if (node instanceof Component) {
            return "ff-component";
        }

        return "ff-system";
    }

    protected getChildren(node: NCG)
    {
        if (node instanceof Node) {
            let children: any = node.components.getArray();
            const hierarchy = node.hierarchy;
            if (hierarchy) {
                children = children.concat(hierarchy.children.map(child => child.node));
            }
            return children;
        }
        if (node instanceof Graph) {
            return node.nodes.findRoots();
        }

        return null;
    }

    protected onClickNode(event: MouseEvent, node: NCG)
    {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

        if (event.clientX - rect.left < 30) {
            this.toggleExpanded(node);
        }
        else if (node instanceof Node) {
            this.selection.selectNode(node, event.ctrlKey);
        }
        else if (node instanceof Component) {
            this.selection.selectComponent(node, event.ctrlKey);
        }
    }

    protected onDblClickNode(event: MouseEvent, treeNode: NCG)
    {
        if (treeNode instanceof CGraph) {
            this.selection.activeGraph = treeNode.innerGraph;
        }
    }

    protected onSelectNode(event: INodeEvent)
    {
        this.setSelected(event.node, event.add);
    }

    protected onSelectComponent(event: IComponentEvent)
    {
        this.setSelected(event.component, event.add);
    }

    protected onActiveGraph(event: IActiveGraphEvent)
    {
        this.root = this.selection.activeGraph;
    }

    protected onUpdate()
    {
        this.requestUpdate();
    }
}