/**
 * FF Typescript Foundation Library
 * Copyright 2018 Ralph Wiedemeier, Frame Factory GmbH
 *
 * License: MIT
 */

import math from "@ff/core/math";

import Property, { IPropertyChangeEvent } from "@ff/graph/Property";

import PopupOptions, { IPopupMenuSelectEvent } from "../PopupOptions";
import CustomElement, { customElement, property, PropertyValues } from "../CustomElement";

////////////////////////////////////////////////////////////////////////////////

export { Property };

@customElement("ff-property-field")
export default class PropertyField extends CustomElement
{
    static readonly defaultPrecision = 2;
    static readonly defaultEditPrecision = 5;
    static readonly defaultSpeed = 0.1;

    @property({ attribute: false })
    property: Property;

    @property({ attribute: false })
    index: number = undefined;

    protected value: any = undefined;
    protected isActive: boolean = false;
    protected isDragging: boolean = false;
    protected startValue: number = 0;
    protected startX: number = 0;
    protected startY: number = 0;
    protected lastX: number = 0;
    protected lastY: number = 0;

    protected editElement: HTMLInputElement = null;
    protected barElement: HTMLDivElement = null;
    protected buttonElement: HTMLDivElement = null;
    protected contentElement: HTMLDivElement = null;

    constructor(property?: Property)
    {
        super();

        this.onFocus = this.onFocus.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onSelectOption = this.onSelectOption.bind(this);

        this.addEventListener("focus", this.onFocus);
        this.addEventListener("click", this.onClick);
        this.addEventListener("contextmenu", this.onContextMenu);
        this.addEventListener("pointerdown", this.onPointerDown);
        this.addEventListener("pointermove", this.onPointerMove);
        this.addEventListener("pointerup", this.onPointerUp);
        this.addEventListener("pointercancel", this.onPointerUp);

        this.property = property;
    }

    protected update(changedProperties: PropertyValues)
    {
        // remove child elements
        if (this.contentElement) {
            this.contentElement.remove();
            this.contentElement = null;
        }
        if (this.barElement) {
            this.barElement.remove();
            this.barElement = null;
        }
        if (this.buttonElement) {
            this.buttonElement.remove();
            this.buttonElement = null;
        }

        const property = this.property;
        const schema = property.schema;

        // create content element
        if (schema.event) {
            this.buttonElement = this.appendElement("div");
            this.buttonElement.classList.add("ff-off", "ff-event-button");
        }
        else {
            // create content (text) element
            this.contentElement = this.appendElement("div");
            this.contentElement.classList.add("ff-off", "ff-content");

            // create bar element
            const { min, max, bar } = schema;
            if (!schema.options && min !== undefined && max !== undefined && bar !== undefined) {
                this.barElement = this.appendElement("div");
                this.barElement.classList.add("ff-fullsize", "ff-off", "ff-bar");
            }
        }

        // set css classes based on property/schema traits
        const classList = this.classList;
        const isInput = property.isInput();
        if (isInput) {
            classList.add("ff-input");
            classList.remove("ff-output");
        }
        else {
            classList.add("ff-output");
            classList.remove("ff-input");
        }

        const isLinked = isInput ? property.hasInLinks(this.index) : property.hasOutLinks(this.index);
        isLinked ? classList.add("ff-linked") : classList.remove("ff-linked");
        schema.event ? classList.add("ff-event") : classList.remove("ff-event");
        schema.options ? classList.add("ff-option") : classList.remove("ff-option");

        // set title attribute to provide information about the property
        this.setAttribute("title", property.toString() + (this.index >= 0 ? `[${this.index}]` : ""));

        this.updateElement();
    }

    protected firstConnected()
    {
        this.tabIndex = 0;

        this.setStyle({
            position: "relative",
            overflow: "hidden"
        });

        this.classList.add("ff-property-field");

        if (!this.property) {
            throw new Error("missing property");
        }
    }

    protected connected()
    {
        this.property.on("value", this.onPropertyValue, this);
        this.property.on<IPropertyChangeEvent>("change", this.onPropertyChange, this);
    }

    protected disconnected()
    {
        this.property.off("value", this.onPropertyValue, this);
        this.property.off<IPropertyChangeEvent>("change", this.onPropertyChange, this);
    }

    protected onFocus(event: FocusEvent)
    {
    }

    protected onClick(event: MouseEvent)
    {
        const property = this.property;
        const schema = property.schema;

        if (schema.event) {
            property.set();
            return;
        }

        if (this.isDragging) {
            return;
        }

        if (schema.options) {
            const popup = new PopupOptions();
            popup.options = schema.options;
            popup.selectionIndex = property.getValidatedValue();
            popup.position = "anchor";
            popup.anchor = this;
            popup.align = "fixed";
            popup.justify = "end";
            popup.positionX = event.clientX - 10;
            popup.keepVisible = true;
            popup.addEventListener(PopupOptions.selectEvent, this.onSelectOption);
            document.body.appendChild(popup);
            return;
        }

        switch(property.type) {
            case "number":
            case "string":
                this.startEditing();
                break;

            case "boolean":
                this.updateProperty(!this.value);
                break;
        }
    }

    protected onContextMenu(event: MouseEvent)
    {
        this.property.reset();
        event.preventDefault();
    }

    protected onPointerDown(event: PointerEvent)
    {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        this.isDragging = false;

        const property = this.property;
        if (property.type !== "number" || property.schema.options) {
            return;
        }

        this.isActive = true;
        this.startX = event.clientX;
        this.startY = event.clientY;
    }

    protected onPointerMove(event: PointerEvent)
    {
        if (!event.isPrimary || !this.isActive) {
            return;
        }

        if (!this.isDragging) {
            const dx = event.clientX - this.startX;
            const dy = event.clientY - this.startY;
            const delta = Math.abs(dx) + Math.abs(dy);
            if (delta > 2) {
                this.setPointerCapture(event.pointerId);
                this.isDragging = true;
                this.startX = event.clientX;
                this.startY = event.clientY;
                this.startValue = this.value;
            }
        }

        if (this.isDragging) {
            const dx = event.clientX - this.startX;
            const dy = event.clientY - this.startY;
            const delta = dx - dy;

            const property = this.property;
            const schema = property.schema;
            let speed = PropertyField.defaultSpeed;
            if (schema.speed) {
                speed = schema.speed;
            }
            else if (schema.min !== undefined && schema.max !== undefined) {
                speed = (schema.max - schema.min) / this.clientWidth;
            }

            speed = event.ctrlKey ? speed * 0.1 : speed;
            speed = event.shiftKey ? speed * 10 : speed;
            let value = this.startValue + delta * speed;

            value = schema.step !== undefined ? Math.trunc(value / schema.step) * schema.step: value;

            value = schema.min !== undefined ? Math.max(value, schema.min) : value;
            value = schema.max !== undefined ? Math.min(value, schema.max) : value;

            this.updateProperty(value);

            event.stopPropagation();
            event.preventDefault();
        }

        this.lastX = event.clientX;
        this.lastY = event.clientY;
    }

    protected onPointerUp(event: PointerEvent)
    {
        if (this.isActive && event.isPrimary) {
            this.isActive = false;

            if (this.isDragging) {
                event.stopPropagation();
                event.preventDefault();
            }
        }
    }

    protected startEditing()
    {
        const property = this.property;
        const schema = property.schema;
        let text = this.value;

        if (property.type === "number") {
            if (isFinite(text)) {
                const precision = schema.precision !== undefined
                    ? schema.precision : PropertyField.defaultEditPrecision;

                text = this.value.toFixed(precision);
            }
            else {
                text = this.value === -Infinity ? "-inf" : "inf";
            }
        }

        const editElement = this.editElement = this.appendElement("input");
        editElement.setAttribute("type", "text");
        editElement.value = text;
        editElement.focus();
        editElement.select();

        editElement.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                this.stopEditing(false);
            }
            else if (e.key === "Enter") {
                this.stopEditing(true);
            }
        });

        editElement.addEventListener("blur", () => {
            this.stopEditing(true);
        });

        PropertyField.setStyle(editElement, {
            position: "absolute", zIndex: "1", boxSizing: "border-box", width: "100%", height: "100%"
        });
    }

    protected stopEditing(commit: boolean)
    {
        if (this.editElement) {
            const editElement = this.editElement;
            this.editElement = null;
            this.removeChild(editElement);

            const property = this.property;
            const schema = property.schema;

            const text = editElement.value;
            let value: any = text;

            if (this.property.type === "number") {
                if (text.toLowerCase().indexOf("inf") >= 0) {
                    value = text[0] === "-" ? -Infinity : Infinity;
                }
                else {
                    value = parseFloat(value) || 0;
                    if (schema.precision) {
                        const factor = Math.pow(10, schema.precision);
                        value = Math.round(value * factor) / factor;
                    }

                    value = schema.min !== undefined ? Math.max(value, schema.min) : value;
                    value = schema.max !== undefined ? Math.min(value, schema.max) : value;
                }
            }

            this.updateProperty(value);
        }
    }

    protected onSelectOption(event: IPopupMenuSelectEvent)
    {
        const index = event.detail.index;
        this.updateProperty(index);
    }

    protected onPropertyValue()
    {
        this.updateElement();
    }

    protected onPropertyChange()
    {
        this.updateElement();
    }

    protected updateElement()
    {
        const property = this.property;
        const schema = property.schema;

        if (schema.event) {
            if (property.changed) {
                this.buttonElement.classList.remove("ff-event-flash");
                setTimeout(() => this.buttonElement.classList.add("ff-event-flash"), 0);
            }

            return;
        }

        let value: any = property.value;
        let text = "";

        if (this.index >= 0) {
            value = value[this.index];
        }

        this.value = value;

        switch(property.type) {
            case "number":
                if (schema.options) {
                    text = property.getOptionText();
                }
                else {
                    if (isFinite(value)) {
                        const precision = schema.precision !== undefined
                            ? schema.precision : PropertyField.defaultPrecision;

                        text = value.toFixed(precision);

                        if (this.barElement) {
                            this.barElement.style.width
                                = math.scaleLimit(value, schema.min, schema.max, 0, 100) + "%";
                        }
                    }
                    else {
                        text = value === -Infinity ? "-inf" : "inf";
                        if (this.barElement) {
                            this.barElement.style.width = "0";
                        }
                    }
                }
                break;

            case "boolean":
                text = value ? "true" : "false";
                break;

            case "string":
                text = value;
                break;

            case "object":
                text = value.toString();
                break;
        }

        this.contentElement.innerText = text;
    }

    protected updateProperty(value: any)
    {
        const property = this.property;
        if (this.index >= 0) {
            property.value[this.index] = value;
            property.set();
        }
        else {
            property.setValue(value);
        }
    }
}