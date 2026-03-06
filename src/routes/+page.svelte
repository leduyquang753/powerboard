<script>
import RBush from "rbush";
import {onMount} from "svelte";

import {LineSimplifier} from "$lib/core/LineSimplification.js";
import OrderMaintenance from "$lib/core/OrderMaintenance.js";
import {generateOutlineAndBoundingBox} from "$lib/core/OutlineGeneration.js";
import PageBackground from "$lib/core/PageBackground.js";
import {eraseStroke} from "$lib/core/StrokeErasure.js";

import ControlGroup from "./ControlGroup.svelte";

let backgroundCanvas;
let canvas;
let canvasWidth = $state(0);
let canvasHeight = $state(0);

let context = $state(null);
let pageBackground = $state(null);

let bush = $state(new RBush());
let orderMaintenance = $state(new OrderMaintenance());

let offsetX = $state(0);
let offsetY = $state(0);
let currentStroke = $state(null);

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
	}).sort((a, b) => {
		const aTag = a.order.tag;
		const bTag = b.order.tag;
		return aTag > bTag ? 1 : aTag === bTag ? 0 : -1;
	})) {
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
	if (currentStroke != null) {
		generateStroke(currentStroke);
		const stroke = currentStroke;
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
		context.fillStyle = currentStroke.color;
		context.fill(currentStroke.outline);
		context.restore();
	}
	context.restore();
}

function scaledPointerOffset(event) {
	return [event.offsetX * window.devicePixelRatio, event.offsetY * window.devicePixelRatio];
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
			render();
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
			render();
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
	pageBackground = new PageBackground(backgroundCanvas);
	pageBackground.updateCanvasSize(canvasWidth, canvasHeight);
	pageBackground.render(offsetX, offsetY);

	canvas.addEventListener("pointerdown", event => {
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
	canvas.addEventListener("pointermove", event => {
		event.preventDefault();
		if (!pointerDown) return;
		const [pointerX, pointerY] = scaledPointerOffset(event);
		if (pointerX === lastPointerX && pointerY === lastPointerY) return;
		lastPointerX = pointerX;
		lastPointerY = pointerY;
		const pressure = event.pointerType === "pen" ? event.pressure : 1;
		currentHandlers.pointermove(event, lastPointerX, lastPointerY, pressure);
	});
	canvas.addEventListener("pointerup", event => {
		event.preventDefault();
		if (!pointerDown) return;
		pointerDown = false;
		currentHandlers.pointerup(event, ...scaledPointerOffset(event));
	});
	canvas.addEventListener("pointerleave", event => {
		if (pointerDown) currentHandlers.pointerup(event);
	});
	window.addEventListener("blur", event => {
		if (pointerDown) currentHandlers.pointerup(event);
	});
	canvas.addEventListener("contextmenu", event => {
		event.preventDefault();
	});
	document.addEventListener("keydown", event => {
		if (event.key === "Delete") {
			bush.clear();
			orderMaintenance = new OrderMaintenance();
			offsetX = 0;
			offsetY = 0;
			pageBackground.render(offsetX, offsetY);
			render();
		} else if (event.key === " ") {
			offsetX = 0;
			offsetY = 0;
			pageBackground.render(offsetX, offsetY);
			render();
		}
	});
	window.addEventListener("resize", event => {
		const root = document.documentElement;
		canvasWidth = Math.round(root.clientWidth * window.devicePixelRatio);
		canvasHeight = Math.round(root.clientHeight * window.devicePixelRatio);
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		pageBackground.updateCanvasSize(canvasWidth, canvasHeight);
		pageBackground.render(offsetX, offsetY);
		render();
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

.controls > :global(*) {
	pointer-events: auto;
}
</style>

<canvas bind:this={backgroundCanvas}></canvas>
<canvas bind:this={canvas}></canvas>
<div class=controls>
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