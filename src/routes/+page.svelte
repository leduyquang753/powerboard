<script>
import {Bezier} from "bezier-js";
import RBush from "rbush";
import {onMount} from "svelte";

import {LineSimplifier} from "$lib/core/LineSimplification.js";
import OrderMaintenance from "$lib/core/OrderMaintenance.js";
import {generateOutlineAndBoundingBox} from "$lib/core/OutlineGeneration.js";
import PageBackground from "$lib/core/PageBackground.js";
import {eraseStroke} from "$lib/core/StrokeErasure.js";

import ControlGroup from "./ControlGroup.svelte";
import Menu from "./Menu.svelte";

let backgroundCanvas;
let canvas;
let activeStrokeCanvas;
let canvasWidth = $state(0);
let canvasHeight = $state(0);

let context = $state.raw(null);
let activeStrokeContext = $state.raw(null);
let pageBackground = $state.raw(null);

let bush = $state.raw(new RBush());
let orderMaintenance = $state.raw(new OrderMaintenance());

let offsetX = $state(0);
let offsetY = $state(0);
let currentStroke = $state.raw(null);

let currentMode = $state("draw");
let drawSize = $state(5);
let drawColor = $state("#000000");
let eraseSize = $state(100);
let eraseWholeStroke = $state(false);

let pointerDown = $state(false);
let originalOffsetX = $state(0);
let originalOffsetY = $state(0);
let firstMouseX = $state(0);
let firstMouseY = $state(0);
let lastPointerX = $state(0);
let lastPointerY = $state(0);

let currentHandlers = $state(null);

function midpoint(p1, p2) {
	return [
		p1[0] + (p2[0] - p1[0]) / 2,
		p1[1] + (p2[1] - p1[1]) / 2
	];
}

function interpolate(p1, p2, t) {
	return [
		p1[0] + (p2[0] - p1[0]) * t,
		p1[1] + (p2[1] - p1[1]) * t,
		p1[2] + (p2[2] - p1[2]) * t
	];
}

function compareStrokeOrder(a, b) {
	const aTag = a.order.tag;
	const bTag = b.order.tag;
	return aTag > bTag ? 1 : aTag === bTag ? 0 : -1;
}

function generateStroke(stroke) {
	const generated = generateOutlineAndBoundingBox(stroke);
	//if (stroke.isFinal) console.log(generated.pathString);
	stroke.outline = new Path2D(generated.pathString);
	stroke.minX = generated.minX;
	stroke.minY = generated.minY;
	stroke.maxX = generated.maxX;
	stroke.maxY = generated.maxY;
	/*
	const spline = generateBezierSpline(stroke.basePath);
	let path = `M${spline[0].controlPoints[0][0]} ${spline[0].controlPoints[0][1]}`;
	for (const segment of spline) {
		const points = segment.controlPoints;
		path += `C${points[1][0]} ${points[1][1]} ${points[2][0]} ${points[2][1]} ${points[3][0]} ${points[3][1]}`;
	}
	stroke.outline = new Path2D(path);
	*/
}

function erase(minX, minY, maxX, maxY) {
	for (const stroke of bush.search({minX, minY, maxX, maxY})) {
		const newStrokes = eraseStroke(stroke, minX, minY, maxX, maxY);
		if (newStrokes === null) continue;
		if (!eraseWholeStroke) for (const newStroke of newStrokes) {
			newStroke.order = orderMaintenance.addNewAfter(stroke.order);
			generateStroke(newStroke);
			bush.insert(newStroke);
		}
		bush.remove(stroke);
		orderMaintenance.remove(stroke.order);
	}
}

function render() {
	context.clearRect(0, 0, canvasWidth, canvasHeight);
	context.save();
	context.translate(offsetX, offsetY);
	for (const stroke of /*bush.all()*/bush.search({
		minX: -offsetX,
		maxX: -offsetX + canvasWidth,
		minY: -offsetY,
		maxY: -offsetY + canvasHeight
	}).sort(compareStrokeOrder)) {
		//if (stroke.simplifier.workingInputPoints.length === 1) continue;
		context.save();
		/*
		context.strokeStyle = stroke.color;
		context.lineWidth = stroke.size;
		const curves = stroke.simplifier.polycurve;
		context.beginPath();
		context.moveTo(curves[0][0][0], curves[0][0][1]);
		for (const curve of curves)
			context.bezierCurveTo(...curve.slice(1).flatMap(p => p));
		context.stroke();
		*/
		context.fillStyle = stroke.color;
		context.fill(stroke.outline);
		/*
		context.fillStyle = "rgb(255 0 0 / 50%)";
		for (const point of stroke.originalPoints) context.fillRect(
			point[0] - 1, point[1] - 1, 3, 3
		);
		*/
		/*
		context.strokeStyle = stroke.color;
		context.lineWidth = stroke.size;
		context.stroke(stroke.outline);
		*/
		/*
		context.strokeStyle = "#FF0000";
		context.strokeWidth = 1;
		context.beginPath();
		context.moveTo(stroke.basePath[0][0], stroke.basePath[0][1]);
		for (let i = 1; i < stroke.basePath.length; ++i) context.lineTo(stroke.basePath[i][0], stroke.basePath[i][1]);
		context.stroke();
		*/
		context.restore();
	}
	context.restore();
}

function renderActiveStroke() {
	activeStrokeContext.clearRect(0, 0, canvasWidth, canvasHeight);
	activeStrokeContext.save();
	activeStrokeContext.translate(offsetX, offsetY);
	if (currentStroke != null) {
		generateStroke(currentStroke);
		activeStrokeContext.save();
		activeStrokeContext.fillStyle = currentStroke.color;
		activeStrokeContext.fill(currentStroke.outline);
		activeStrokeContext.restore();
	}
	activeStrokeContext.restore();
}

function scaledPointerOffset(event) {
	return [event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio];
}

function onOpenWhiteboard() {
	console.log("Open whiteboard.");
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".pwb";
	input.addEventListener("change", async () => {
		if (input.files === null) return;
		const data = JSON.parse(await input.files[0].text());
		bush.clear();
		currentStroke = null;
		orderMaintenance = new OrderMaintenance();
		offsetX = 0;
		offsetY = 0;
		for (const strokeData of data) {
			strokeData.isFinal = true;
			for (const segment of strokeData.spline) {
				segment.bezier = new Bezier(segment.bezier);
			}
			strokeData.order = orderMaintenance.addNewAfter(orderMaintenance.tail);
			generateStroke(strokeData);
			bush.insert(strokeData);
		}
		pageBackground.render(offsetX, offsetY);
		render();
		renderActiveStroke();
	});
	input.showPicker();
}

function onSaveWhiteboard() {
	console.log("Save whiteboard.");
	const link = document.createElement("a");
	const date = new Date();
	link.download = (
		`Whiteboard – ${date.getHours()}h${date.getMinutes().toString().padStart(2, '0')}.`
		+ `${date.getSeconds().toString().padStart(2, '0')}; `
		+ `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}.pwb`
	);
	const url = URL.createObjectURL(new Blob([JSON.stringify(bush.all().sort(compareStrokeOrder).map(stroke => {
		const strokeData = {
			isSimple: stroke.isSimple,
			size: stroke.size,
			color: stroke.color
		};
		if (stroke.isSimple) {
			strokeData.basePath = stroke.basePath;
		} else {
			strokeData.spline = stroke.spline.map(segment => ({
				bezier: segment.bezier.points.map(point => ({x: point.x, y: point.y})),
				startWeight: segment.startWeight,
				endWeight: segment.endWeight
			}));
		}
		return strokeData;
	}))]));
	link.href = url;
	link.click();
	setTimeout(() => { URL.revokeObjectURL(url); }, 1);
}

const handlers = {
	draw: {
		pointerdown: (event, pointerX, pointerY, pressure) => {
			currentStroke = {
				isDraft: false,
				isSimple: true,
				size: event.pointerType == "pen" ? drawSize * 2 : drawSize,
				color: drawColor,
				basePath: [[pointerX - offsetX, pointerY - offsetY, pressure]],
				simplifier: new LineSimplifier([pointerX - offsetX, pointerY - offsetY, pressure], drawSize)
			};
			currentStroke.spline = [...currentStroke.simplifier.spline.map(s => ({...s}))];
			renderActiveStroke();
		},
		pointermove: (event, pointerX, pointerY, pressure) => {
			currentStroke.basePath.push([pointerX - offsetX, pointerY - offsetY, pressure]);
			currentStroke.simplifier.addPoint([pointerX - offsetX, pointerY - offsetY, pressure]);
			const newSpline = currentStroke.simplifier.spline;
			if (newSpline.length === currentStroke.spline.length) {
				currentStroke.spline[currentStroke.spline.length - 1] = {...newSpline[newSpline.length - 1]};
			} else {
				currentStroke.spline.push({...newSpline[newSpline.length - 1]});
			}
			currentStroke.isSimple = currentStroke.basePath.length < 3;
			renderActiveStroke();
		},
		pointerup: (event, pointerX, pointerY) => {
			currentStroke.isFinal = true;
			currentStroke.order = orderMaintenance.addNewAfter(orderMaintenance.tail);
			const stroke = currentStroke;/*{
				isDraft: false,
				size: drawSize,
				color: drawColor,
				basePath: currentStroke.basePath,
				order: orderMaintenance.addNewAfter(orderMaintenance.tail)
			};
			*/
			/*
			const polycurve = currentStroke.simplifier.spline;
			let c = polycurve[0].bezier.points;
			let s = `M ${c[0].x} ${c[0].y} C ${c[1].x} ${c[1].y} ${c[2].x} ${c[2].y} ${c[3].x} ${c[3].y}`;
			for (let i = 1; i < polycurve.length; ++i) {
				let c = polycurve[i].bezier.points;
				s += ` ${c[1].x} ${c[1].y} ${c[2].x} ${c[2].y} ${c[3].x} ${c[3].y}`;
			}
			console.log(s);
			*/
			generateStroke(stroke);
			bush.insert(stroke);
			currentStroke = null;
			render();
			renderActiveStroke();
		}
	},
	erase: {
		pointerdown: (event, pointerX, pointerY) => {
			const halfEraseSize = eraseSize / 2;
			erase(
				pointerX - offsetX - halfEraseSize,
				pointerY - offsetY - halfEraseSize,
				pointerX - offsetX + halfEraseSize,
				pointerY - offsetY + halfEraseSize
			);
			render();
		},
		pointermove: (event, pointerX, pointerY) => {
			const halfEraseSize = eraseSize / 2;
			erase(
				pointerX - offsetX - halfEraseSize,
				pointerY - offsetY - halfEraseSize,
				pointerX - offsetX + halfEraseSize,
				pointerY - offsetY + halfEraseSize
			);
			render();
		},
		pointerup: (event, pointerX, pointerY) => {
		}
	},
	pan: {
		pointerdown: (event, pointerX, pointerY) => {
			originalOffsetX = offsetX;
			originalOffsetY = offsetY;
			firstMouseX = pointerX;
			firstMouseY = pointerY;
		},
		pointermove: (event, pointerX, pointerY) => {
			offsetX = originalOffsetX - firstMouseX + pointerX;
			offsetY = originalOffsetY - firstMouseY + pointerY;
			pageBackground.render(offsetX, offsetY);
			render();
		},
		pointerup: (event, pointerX, pointerY) => {
		}
	}
};

const buttonsToHandle = new Set([0, 1, 2, 5]);

function onModeSelect(newMode) {
	currentMode = newMode;
}

const onDrawSelect = {
	"color": () => {
		const color = prompt("Enter color as 3-digit or 6-digit hexadecimal code:");
		if (color === null || !color.match(/^[0-9A-F]{3}(?:[0-9A-F]{3})?$/i)) return;
		drawColor = "#" + color.toUpperCase();
	},
	"size": () => {
		const sizeString = prompt("Enter pen size:");
		if (sizeString === null || sizeString === "") return;
		const size = Number(sizeString);
		if (Number.isNaN(size)) return;
		drawSize = Math.max(1, Math.min(100, size));
	}
};

const onEraseSelect = {
	"mode": () => {
		eraseWholeStroke = !eraseWholeStroke;
	},
	"size": () => {
		const sizeString = prompt("Enter eraser size:");
		if (sizeString === null || sizeString === "") return;
		const size = Number(sizeString);
		if (Number.isNaN(size)) return;
		eraseSize = Math.max(1, Math.min(1000, size));
	}
};

function onPanSelect() {
	offsetX = 0;
	offsetY = 0;
	pageBackground.render(offsetX, offsetY);
	render();
}

onMount(() => {
	const root = document.documentElement;
	canvasWidth = Math.round(root.clientWidth * window.devicePixelRatio);
	canvasHeight = Math.round(root.clientHeight * window.devicePixelRatio);
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	context = canvas.getContext("2d");
	context.strokeStyle = "black";
	context.fillStyle = "black";
	context.lineCap = "round";
	activeStrokeCanvas.width = canvasWidth;
	activeStrokeCanvas.height = canvasHeight;
	activeStrokeContext = activeStrokeCanvas.getContext("2d");
	activeStrokeContext.strokeStyle = "black";
	activeStrokeContext.fillStyle = "black";
	activeStrokeContext.lineCap = "round";
	pageBackground = new PageBackground(backgroundCanvas);
	pageBackground.updateCanvasSize(canvasWidth, canvasHeight);
	pageBackground.render(offsetX, offsetY);

	activeStrokeCanvas.addEventListener("pointerdown", event => {
	  if (!buttonsToHandle.has(event.button)) return;
		event.preventDefault();
		pointerDown = true;
		[lastPointerX, lastPointerY] = scaledPointerOffset(event);
		const pressure = event.pointerType === "pen" ? event.pressure : 1;
		let handlerName;
		switch (currentMode) {
			case "draw":
				handlerName = event.getModifierState("Shift") || event.button === 2 || event.button === 5 ? "erase"
					: event.getModifierState("Control") || event.button === 1 ? "pan"
					: "draw";
				break;
			case "erase":
				handlerName = event.getModifierState("Shift") || event.button === 2 ? "draw"
					: event.getModifierState("Control") || event.button === 1 ? "pan"
					: "erase";
				break;
			case "pan":
				handlerName = "pan";
				break;
		}
		currentHandlers = handlers[handlerName];
		currentHandlers.pointerdown(event, lastPointerX, lastPointerY, pressure);
	});
	document.addEventListener("pointermove", event => {
		if (!pointerDown) return;
		event.preventDefault();
		const [pointerX, pointerY] = scaledPointerOffset(event);
		if (pointerX === lastPointerX && pointerY === lastPointerY) return;
		lastPointerX = pointerX;
		lastPointerY = pointerY;
		const pressure = event.pointerType === "pen" ? event.pressure : 1;
		currentHandlers.pointermove(event, lastPointerX, lastPointerY, pressure);
	});
	document.addEventListener("pointerup", event => {
		if (!pointerDown) return;
		event.preventDefault();
		pointerDown = false;
		currentHandlers.pointerup(event, ...scaledPointerOffset(event));
	});
	window.addEventListener("blur", event => {
		if (pointerDown) currentHandlers.pointerup(event);
	});
	activeStrokeCanvas.addEventListener("contextmenu", event => {
		event.preventDefault();
	});
	document.addEventListener("keydown", event => {
		if (event.key === "Delete") {
			bush.clear();
			currentStroke = null;
			orderMaintenance = new OrderMaintenance();
			offsetX = 0;
			offsetY = 0;
			pageBackground.render(offsetX, offsetY);
			render();
			renderActiveStroke();
		} else if (event.key === " ") {
			offsetX = 0;
			offsetY = 0;
			pageBackground.render(offsetX, offsetY);
			render();
			renderActiveStroke();
		}
	});
	window.addEventListener("resize", event => {
		const root = document.documentElement;
		canvasWidth = Math.round(root.clientWidth * window.devicePixelRatio);
		canvasHeight = Math.round(root.clientHeight * window.devicePixelRatio);
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		activeStrokeCanvas.width = canvasWidth;
		activeStrokeCanvas.height = canvasHeight;
		pageBackground.updateCanvasSize(canvasWidth, canvasHeight);
		pageBackground.render(offsetX, offsetY);
		render();
		renderActiveStroke();
	});
});
</script>

<style>
canvas {
	position: absolute;
	top: 0;
	left: 0;
	width: 100dvw;
	height: 100dvh;
	touch-action: none;
}

:global(.disabledMenu) {
	pointer-events: none;
}

.controls {
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100dvw;
	padding: 1em;
	display: flex;
	flex-direction: row;
	justify-content: center;
	gap: 1em;
	pointer-events: none;
	user-select: none;
}

.enabledControls > :global(*) {
	pointer-events: auto;
}
</style>

<canvas bind:this={backgroundCanvas}></canvas>
<canvas bind:this={canvas}></canvas>
<canvas bind:this={activeStrokeCanvas}></canvas>
<div class={{controls: true, enabledControls: !pointerDown}}>
	<ControlGroup items={[
		{key: "draw", text: "Draw"},
		{key: "erase", text: "Erase"},
		{key: "pan", text: "Pan"}
	]} activeItem={currentMode} onSelect={onModeSelect}/>
	{#if currentMode === "draw"}
		<ControlGroup items={[
			{key: "color", text: `Color: ${drawColor}`},
			{key: "size", text: `Size: ${drawSize}`}
		]} onSelect={key => { onDrawSelect[key](); }}/>
	{/if}
	{#if currentMode === "erase"}
		<ControlGroup items={[
			{key: "mode", text: `Mode: ${eraseWholeStroke ? "whole" : "partial"}`},
			{key: "size", text: `Size: ${eraseSize}`}
		]} onSelect={key => { onEraseSelect[key](); }}/>
	{/if}
	{#if currentMode === "pan"}
		<ControlGroup items={[
			{key: "reset", text: "Reset"}
		]} onSelect={onPanSelect}/>
	{/if}
</div>
<Menu
	class={{disabledMenu: pointerDown}}
	onOpenWhiteboard={onOpenWhiteboard} onSaveWhiteboard={onSaveWhiteboard}
/>