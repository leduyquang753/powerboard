import * as Freehand from "perfect-freehand";
import RBush from "rbush";

(() => {

const canvasWidth = Math.round(window.innerWidth * window.devicePixelRatio);
const canvasHeight = Math.round(window.innerHeight * window.devicePixelRatio);
const canvas = document.createElement("canvas");
canvas.width = canvasWidth;
canvas.height = canvasHeight;
canvas.style.width = canvasWidth + "px";
canvas.style.height = canvasHeight + "px";
canvas.style.touchAction = "none";
document.body.appendChild(canvas);

const context = canvas.getContext("2d");
context.strokeStyle = "black";
context.fillStyle = "black";
context.lineCap = "round";

const bush = new RBush();
let offsetX = 0;
let offsetY = 0;
let currentStroke = null;

function midpoint(p1, p2) {
	return [p1[0] + (p2[0] - p1[0]) / 2, p1[1] + (p2[1] - p1[1]) / 2];
}

function interpolate(p1, p2, t) {
	return [
		p1[0] + (p2[0] - p1[0]) * t,
		p1[1] + (p2[1] - p1[1]) * t,
		p1[2] + (p2[2] - p1[2]) * t
	];
}

function generateStroke(stroke) {
	const outline = Freehand.getStroke(stroke.basePath, {size: 4, streamline: 0, simulatePressure: false});

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
	stroke.minX = minX;
	stroke.maxX = maxX;
	stroke.minY = minY;
	stroke.maxY = maxY;

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
			newStrokes.push({basePath: currentNewStrokePoints});
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
		for (const newStroke of newStrokes) {
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
	})) context.fill(stroke.outline);
	if (currentStroke != null) {
		generateStroke(currentStroke);
		context.fill(currentStroke.outline);
	}
	context.restore();
}

let shiftDown = false;
let ctrlDown = false;
let pointerDown = false;

let originalOffsetX = 0;
let originalOffsetY = 0;
let firstMouseX = 0;
let firstMouseY = 0;

const onKey = event => {
	shiftDown = event.shiftKey;
	ctrlDown = event.ctrlKey;
};
document.addEventListener("keydown", onKey);
document.addEventListener("keyup", onKey);

const handlers = {
	draw: {
		pointerdown: event => {
			currentStroke = {basePath: [[event.offsetX - offsetX, event.offsetY - offsetY, event.pressure]]};
			render();
		},
		pointermove: event => {
			currentStroke.basePath.push([event.offsetX - offsetX, event.offsetY - offsetY, event.pressure]);
			render();
		},
		pointerup: event => {
			const stroke = {basePath: currentStroke.basePath};
			generateStroke(stroke);
			bush.insert(stroke);
			currentStroke = null;
			render();
		}
	},
	erase: {
		pointerdown: event => {
			erase(
				event.offsetX - offsetX - 10,
				event.offsetY - offsetY - 10,
				event.offsetX - offsetX + 10,
				event.offsetY - offsetY + 10
			);
			render();
		},
		pointermove: event => {
			erase(
				event.offsetX - offsetX - 10,
				event.offsetY - offsetY - 10,
				event.offsetX - offsetX + 10,
				event.offsetY - offsetY + 10
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
let currentHandlers = null;

canvas.addEventListener("pointerdown", event => {
	event.preventDefault();
	pointerDown = true;
	currentHandlers
		= shiftDown ? handlers.erase
		: ctrlDown ? handlers.pan
		: handlers.draw;
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
	}
});

})();