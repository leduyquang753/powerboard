import * as Freehand from "perfect-freehand";
import RBush from "rbush";

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
let offsetX = 0;
let offsetY = 0;
let currentStroke = null;

let currentMode = 0;
let drawSize = 4;
let drawColor = "#000000";
let eraseSize = 20;
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
	const outline = Freehand.getStroke(stroke.basePath, {size: stroke.size, streamline: 0, simulatePressure: false});

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
	stroke.minX = minX - drawSize;
	stroke.maxX = maxX + drawSize;
	stroke.minY = minY - drawSize;
	stroke.maxY = maxY + drawSize;

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
}

function erase(minX, minY, maxX, maxY) {
	for (const stroke of bush.search({minX, minY, maxX, maxY})) {
		const pointCount = stroke.basePath.length;
		if (pointCount === 1) {
			const point = stroke.basePath[0];
			if (point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY) bush.remove(stroke);
			continue;
		}
		let erased = false;
		const newStrokes = [];
		let currentNewStrokePoints = [];
		const terminateNewStroke = () => {
			if (currentNewStrokePoints.length === 0) return;
			newStrokes.push({size: stroke.size, color: stroke.color, basePath: currentNewStrokePoints});
			currentNewStrokePoints = [];
		};
		const addNewStrokeSegment = (newPoint1, newPoint2) => {
			if (currentNewStrokePoints.length === 0) currentNewStrokePoints.push(newPoint1);
			currentNewStrokePoints.push(newPoint2);
		};
		for (let i = 0; i < pointCount - 1; ++i) {
			const point1 = stroke.basePath[i];
			const point2 = stroke.basePath[i + 1];
			const bx = point1[0];
			const by = point1[1];
			const dx = point2[0] - point1[0];
			const dy = point2[1] - point1[1];
			const p = [-dx, dx, -dy, dy];
			const q = [bx - minX, maxX - bx, by - minY, maxY - by];
			let u1 = -Infinity;
			let u2 = Infinity;
			for (let j = 0; j !== 4; ++j) {
				if (p[j] === 0) {
					if (q[j] < 0) {
						u1 = 1;
						u2 = 0;
						break;
					}
				} else {
					const t = q[j] / p[j];
					if (p[j] < 0 && u1 < t) u1 = t;
					else if (p[j] > 0 && u2 > t) u2 = t;
				}
			}
			if (u1 > u2 || (u1 <= 0 && u2 <= 0) || (u1 >= 1 && u2 >= 1)) { // No erasure.
				addNewStrokeSegment(point1, point2);
			} else { // There is erasure.
				erased = true;
				if (u1 <= 0) {
					// If u2 > 1, the whole segment is erased.
					if (u2 < 1) { // Erased before u2.
						terminateNewStroke();
						addNewStrokeSegment(interpolate(point1, point2, u2), point2);
					}
				} else {
					if (u2 >= 1) { // Erased after u1.
						addNewStrokeSegment(point1, interpolate(point1, point2, u1));
						terminateNewStroke();
					} else { // Erased from u1 to u2.
						addNewStrokeSegment(point1, interpolate(point1, point2, u1));
						terminateNewStroke();
						addNewStrokeSegment(interpolate(point1, point2, u2), point2);
					}
				}
			}
		}
		terminateNewStroke();
		if (!erased) continue;
		bush.remove(stroke);
		if (!eraseWholeStroke) for (const newStroke of newStrokes) {
			generateStroke(newStroke);
			bush.insert(newStroke);
		}
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
	})) {
		context.save();
		context.fillStyle = stroke.color;
		context.fill(stroke.outline);
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

let pointerDown = false;
let originalOffsetX = 0;
let originalOffsetY = 0;
let firstMouseX = 0;
let firstMouseY = 0;

const handlers = {
	draw: {
		pointerdown: event => {
			currentStroke = {
				size: drawSize,
				color: drawColor,
				basePath: [[event.offsetX - offsetX, event.offsetY - offsetY, event.pressure]]
			};
			render();
		},
		pointermove: event => {
			currentStroke.basePath.push([event.offsetX - offsetX, event.offsetY - offsetY, event.pressure]);
			render();
		},
		pointerup: event => {
			const stroke = {
				size: drawSize,
				color: drawColor,
				basePath: currentStroke.basePath
			};
			generateStroke(stroke);
			bush.insert(stroke);
			currentStroke = null;
			render();
		}
	},
	erase: {
		pointerdown: event => {
			const halfEraseSize = eraseSize / 2;
			erase(
				event.offsetX - offsetX - halfEraseSize,
				event.offsetY - offsetY - halfEraseSize,
				event.offsetX - offsetX + halfEraseSize,
				event.offsetY - offsetY + halfEraseSize
			);
			render();
		},
		pointermove: event => {
			const halfEraseSize = eraseSize / 2;
			erase(
				event.offsetX - offsetX - halfEraseSize,
				event.offsetY - offsetY - halfEraseSize,
				event.offsetX - offsetX + halfEraseSize,
				event.offsetY - offsetY + halfEraseSize
			);
			render();
		},
		pointerup: event => {
		}
	},
	pan: {
		pointerdown: event => {
			originalOffsetX = offsetX;
			originalOffsetY = offsetY;
			firstMouseX = event.offsetX;
			firstMouseY = event.offsetY;
		},
		pointermove: event => {
			offsetX = originalOffsetX - firstMouseX + event.offsetX;
			offsetY = originalOffsetY - firstMouseY + event.offsetY;
			render();
		},
		pointerup: event => {
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
	currentHandlers = handlers[modeMapping[currentMode][
		event.getModifierState("Shift") ? 1
		: event.getModifierState("Control") ? 2
		: 0
	]];
	currentHandlers.pointerdown(event);
});
canvas.addEventListener("pointermove", event => {
	event.preventDefault();
	if (!pointerDown) return;
	currentHandlers.pointermove(event);
});
canvas.addEventListener("pointerup", event => {
	event.preventDefault();
	if (!pointerDown) return;
	pointerDown = false;
	currentHandlers.pointerup(event);
});
document.addEventListener("keydown", event => {
	if (event.key === "Delete") {
		bush.clear();
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
for (let mode = 0; mode !== 3; ++mode) modeSelector.children[mode].addEventListener("click", event => {
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