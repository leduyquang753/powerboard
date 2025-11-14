import * as Freehand from "perfect-freehand";
import RBush from "rbush";

import {simplifyStroke} from "./LineSimplification.js";
import OrderMaintenance from "./OrderMaintenance.js";
import {generateBezierSpline, generateOutlineAndBoundingBox} from "./OutlineGeneration.js";
import {eraseStroke} from "./StrokeErasure.js";

(() => {

let canvasWidth = Math.round(window.innerWidth * window.devicePixelRatio);
let canvasHeight = Math.round(window.innerHeight * window.devicePixelRatio);
const canvas = document.createElement("canvas");
canvas.width = canvasWidth;
canvas.height = canvasHeight;
canvas.style.width = "100vw";
canvas.style.height = "100vh";
canvas.style.touchAction = "none";
document.body.appendChild(canvas);

const context = canvas.getContext("2d");
context.strokeStyle = "black";
context.fillStyle = "black";
context.lineCap = "round";

const modeSelector = document.getElementById("modeSelector");
const drawControls = document.getElementById("drawOptions");
const eraseControls = document.getElementById("eraseOptions");
const panControls = document.getElementById("panOptions");

const bush = new RBush();
let orderMaintenance = new OrderMaintenance();
let offsetX = 0;
let offsetY = 0;
let currentStroke = null;

let currentMode = 0;
let drawSize = 4;
let drawColor = "#000000";
let eraseSize = 40;
let eraseWholeStroke = false;

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
	if (stroke.isDraft) {
		const outline = Freehand.getStroke(stroke.basePath, {
			size: stroke.size / 2, streamline: 0, thinning: 1, simulatePressure: false
		});

		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const point of outline) {
			minX = Math.min(minX, point[0]);
			maxX = Math.max(maxX, point[0]);
			minY = Math.min(minY, point[1]);
			maxY = Math.max(maxY, point[1]);
		}
		// Add 1-pixel padding for certainty that the stroke is visible when at the edge of the screen.
		stroke.minX = minX - 1;
		stroke.maxX = maxX + 1;
		stroke.minY = minY - 1;
		stroke.maxY = maxY + 1;

		const pointCount = outline.length;
		const firstPoint = midpoint(outline[0], outline[pointCount - 1]);
		const secondPoint = midpoint(outline[0], outline[1]);
		let path = (
			`M${firstPoint[0]} ${firstPoint[1]}`
			+ `Q${outline[0][0]} ${outline[0][1]} ${secondPoint[0]} ${secondPoint[1]}`
		);
		for (let i = 1; i < pointCount - 1; ++i) {
			const newPoint = midpoint(outline[i], outline[i + 1]);
			path += `T${newPoint[0]} ${newPoint[1]}`;
		}
		path += `T${firstPoint[0]} ${firstPoint[1]}Z`;
		stroke.outline = new Path2D(path);
	} else {
		const generated = generateOutlineAndBoundingBox(stroke);
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
	for (const stroke of bush.search({
		minX: -offsetX,
		maxX: -offsetX + canvasWidth,
		minY: -offsetY,
		maxY: -offsetY + canvasHeight
	}).sort((a, b) => {
		const aTag = a.order.tag;
		const bTag = b.order.tag;
		return aTag > bTag ? 1 : aTag === bTag ? 0 : -1;
	})) {
		context.save();
		context.fillStyle = stroke.color;
		context.fill(stroke.outline);
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
		context.save();
		context.fillStyle = currentStroke.color;
		context.fill(currentStroke.outline);
		context.restore();
	}
	context.restore();
}

function updateMode() {
	for (const control of modeSelector.children) control.classList.remove("activeControl");
	modeSelector.children[currentMode].classList.add("activeControl");
	if (currentMode === 0) drawControls.classList.add("visibleControlGroup");
	else drawControls.classList.remove("visibleControlGroup");
	if (currentMode === 1) eraseControls.classList.add("visibleControlGroup");
	else eraseControls.classList.remove("visibleControlGroup");
	if (currentMode === 2) panControls.classList.add("visibleControlGroup");
	else panControls.classList.remove("visibleControlGroup");
}

function updateDrawOptions() {
	drawControls.children[0].innerText = `Color: ${drawColor}`;
	drawControls.children[1].innerText = `Size: ${drawSize}`;
}

function updateEraseOptions() {
	eraseControls.children[0].innerText = `Mode: ${eraseWholeStroke ? "whole" : "partial"}`;
	eraseControls.children[1].innerText = `Size: ${eraseSize}`;
}

function scaledPointerOffset(event) {
	return [event.offsetX * window.devicePixelRatio, event.offsetY * window.devicePixelRatio];
}

let pointerDown = false;
let originalOffsetX = 0;
let originalOffsetY = 0;
let firstMouseX = 0;
let firstMouseY = 0;
let lastPointerX = 0;
let lastPointerY = 0;

const handlers = {
	draw: {
		pointerdown: (event, pointerX, pointerY, pressure) => {
			currentStroke = {
				isDraft: true,
				size: drawSize,
				color: drawColor,
				basePath: [[pointerX - offsetX, pointerY - offsetY, pressure]]
			};
			render();
		},
		pointermove: (event, pointerX, pointerY, pressure) => {
			currentStroke.basePath.push([pointerX - offsetX, pointerY - offsetY, pressure]);
			render();
		},
		pointerup: (event, pointerX, pointerY) => {
			const stroke = {
				isDraft: false,
				isSimple: currentStroke.basePath.length < 3,
				size: drawSize,
				color: drawColor,
				basePath: currentStroke.basePath.length < 3
					? currentStroke.basePath
					: generateBezierSpline(simplifyStroke(currentStroke.basePath, currentStroke.size)),
				order: orderMaintenance.addNewAfter(orderMaintenance.tail)
			};
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
			render();
		},
		pointerup: (event, pointerX, pointerY) => {
		}
	}
};
const modeMapping = [
	["draw", "erase", "pan"],
	["erase", "draw", "pan"],
	["pan", "pan", "pan"]
];
let currentHandlers = null;

canvas.addEventListener("pointerdown", event => {
	event.preventDefault();
	pointerDown = true;
	[lastPointerX, lastPointerY] = scaledPointerOffset(event);
	const pressure = event.pointerType === "pen" ? event.pressure : 1;
	currentHandlers = handlers[modeMapping[currentMode][
		event.getModifierState("Shift") ? 1
		: event.getModifierState("Control") ? 2
		: 0
	]];
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
document.addEventListener("keydown", event => {
	if (event.key === "Delete") {
		bush.clear();
		orderMaintenance = new OrderMaintenance();
		offsetX = 0;
		offsetY = 0;
		render();
	} else if (event.key === " ") {
		offsetX = 0;
		offsetY = 0;
		render();
	}
});
window.addEventListener("resize", event => {
	canvasWidth = Math.round(window.innerWidth * window.devicePixelRatio);
	canvasHeight = Math.round(window.innerHeight * window.devicePixelRatio);
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	render();
});
for (let mode = 0; mode < 3; ++mode) modeSelector.children[mode].addEventListener("click", event => {
	currentMode = mode;
	updateMode();
});
drawControls.children[0].addEventListener("click", event => {
	const color = prompt("Enter color as 3-digit or 6-digit hexadecimal code:");
	if (color === null || !color.match(/^[0-9A-F]{3}(?:[0-9A-F]{3})?$/i)) return;
	drawColor = "#" + color.toUpperCase();
	updateDrawOptions();
});
drawControls.children[1].addEventListener("click", event => {
	const sizeString = prompt("Enter pen size:");
	if (sizeString === null || sizeString === "") return;
	const size = Number(sizeString);
	if (Number.isNaN(size)) return;
	drawSize = Math.max(1, Math.min(100, size));
	updateDrawOptions();
});
eraseControls.children[0].addEventListener("click", event => {
	eraseWholeStroke = !eraseWholeStroke;
	updateEraseOptions();
});
eraseControls.children[1].addEventListener("click", event => {
	const sizeString = prompt("Enter eraser size:");
	if (sizeString === null || sizeString === "") return;
	const size = Number(sizeString);
	if (Number.isNaN(size)) return;
	eraseSize = Math.max(1, Math.min(100, size));
	updateEraseOptions();
});
panControls.children[0].addEventListener("click", event => {
	offsetX = 0;
	offsetY = 0;
	render();
});

updateMode();
updateDrawOptions();
updateEraseOptions();

})();