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
let currentStroke = null;

function midpoint(p1, p2) {
	return [p1[0] + (p2[0] - p1[0]) / 2, p1[1] + (p2[1] - p1[1]) / 2];
}

function generateStroke(stroke) {
	const outline = Freehand.getStroke(stroke.basePath, {size: 4, simulatePressure: false});

	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const point of outline) {
		minX = Math.min(minX, point[0]);
		maxX = Math.max(maxX, point[0]);
		minY = Math.min(minY, point[0]);
		maxY = Math.max(maxY, point[0]);
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

function render() {
	context.clearRect(0, 0, canvasWidth, canvasHeight);
	for (const stroke of bush.search({minX: 0, maxX: canvasWidth, minY: 0, maxY: canvasHeight}))
		context.fill(stroke.outline);
	if (currentStroke != null) {
		generateStroke(currentStroke);
		context.fill(currentStroke.outline);
	}
}

let pointerDown = false;
canvas.addEventListener("pointerdown", event => {
	event.preventDefault();
	pointerDown = true;
	currentStroke = {basePath: [[event.offsetX, event.offsetY, event.pressure]]};
	render();
});
canvas.addEventListener("pointermove", event => {
	event.preventDefault();
	if (!pointerDown) return;
	currentStroke.basePath.push([event.offsetX, event.offsetY, event.pressure]);
	render();
});
canvas.addEventListener("pointerup", event => {
	event.preventDefault();
	pointerDown = false;
	const stroke = {basePath: currentStroke.basePath};
	generateStroke(stroke);
	bush.insert(stroke);
	currentStroke = null;
	render();
});
document.addEventListener("keydown", event => {
	if (event.key === "Delete") {
		bush.clear();
		render();
	}
});

})();