import {Bezier} from "bezier-js";

import {fitBezier} from "./BezierFitting.js";

const MAX_ERROR = 1 ** 2;
const MAX_WIDTH_DEVIATION = 2;

function squaredDistance(point1, point2) {
	const dx = point1[0] - point2[0];
	const dy = point1[1] - point2[1];
	return dx*dx + dy*dy;
}

function getEndTangent(segment) {
	const points = segment.bezier.points;
	const lastPoint = points[3];
	for (let i = 2; i >= 0; --i) {
		const controlPoint = points[i];
		if ((controlPoint.x - lastPoint.x) ** 2 + (controlPoint.y - lastPoint.y) ** 2 < 1e-6) continue;
		const tangent = [
			lastPoint.x - controlPoint.x,
			lastPoint.y - controlPoint.y
		];
		const length = Math.sqrt(tangent[0] * tangent[0] + tangent[1] * tangent[1]);
		return [tangent[0] / length, tangent[1] / length];
	}
	return [0, 0];
}

function polylineHasNonLinearWeight(points, pressureTolerance) {
	if (points.length < 3) return false;
	let totalLength = 0;
	for (let i = 1; i < points.length; ++i) totalLength += Math.sqrt(squaredDistance(points[i - 1], points[i]));
	const startWeight = points[0][2];
	const endWeight = points.at(-1)[2];
	let cumulativeLength = 0;
	for (let i = 1; i < points.length - 1; ++i) {
		cumulativeLength += Math.sqrt(squaredDistance(points[i - 1], points[i]));
		if (
			Math.abs(startWeight + (endWeight - startWeight) * (cumulativeLength / totalLength) - points[i][2])
			> pressureTolerance
		) return true;
	}
	return false;
}

function createBezier(...points) {
	return new Bezier(points.map(point => ({x: point[0], y: point[1]})));
}

export class LineSimplifier {
	constructor(firstPoint, size) {
		this.pressureTolerance = Math.min(0.1, 2 / size);
		this.finishedSegments = [];
		this.lastDirection = null;
		this.workingSegment = {
			bezier: createBezier(firstPoint, firstPoint, firstPoint, firstPoint),
			startWeight: firstPoint[2],
			endWeight: firstPoint[2]
		};
		this.workingInputPoints = [firstPoint];
	}

	#startNewStroke() {
		const beforeLastPoint = this.workingInputPoints.at(-3);
		const newPoint = this.workingInputPoints.at(-1);
		let newDirection = [newPoint[0] - beforeLastPoint[0], newPoint[1] - beforeLastPoint[1]];
		const newDirectionLength = Math.sqrt(newDirection[0] * newDirection[0] + newDirection[1] * newDirection[1]);
		if (newDirectionLength !== 0) {
			newDirection = [newDirection[0] / newDirectionLength, newDirection[1] / newDirectionLength];
			const newCurve = fitBezier(
				this.workingInputPoints.slice(0, -1).map(point => point.slice(0, 2)),
				this.lastDirection, [-newDirection[0], -newDirection[1]], MAX_ERROR, null
			);
			if (newCurve !== null) {
				this.workingSegment = {
					bezier: createBezier(...newCurve),
					startWeight: this.workingSegment.startWeight,
					endWeight: this.workingSegment.endWeight
				};
			}
		}
		this.finishedSegments.push(this.workingSegment);
		this.lastDirection = newDirection;
	}

	addPoint(newPoint) {
		const lastPoint = this.workingInputPoints.at(-1);
		this.workingInputPoints.push(newPoint);
		if (polylineHasNonLinearWeight(this.workingInputPoints, this.pressureTolerance)) {
			this.#startNewStroke();
			this.workingInputPoints = [lastPoint, newPoint];
			this.workingSegment = {
				bezier: createBezier(lastPoint, lastPoint, newPoint, newPoint),
				startWeight: lastPoint[2],
				endWeight: newPoint[2]
			};
		}
		const newCurve = fitBezier(
			this.workingInputPoints.map(point => point.slice(0, 2)), this.lastDirection, null, MAX_ERROR, null
		);
		if (newCurve !== null) {
			this.workingSegment = {
				bezier: createBezier(...newCurve),
				startWeight: this.workingSegment.startWeight,
				endWeight: newPoint[2]
			};
			return;
		}
		this.#startNewStroke();
		this.workingInputPoints = [lastPoint, newPoint];
		this.workingSegment = {
			bezier: createBezier(...fitBezier(
				this.workingInputPoints.map(point => point.slice(0, 2)), this.lastDirection, null, MAX_ERROR, null
			)),
			startWeight: lastPoint[2],
			endWeight: newPoint[2]
		};
	}

	get spline() {
		return [...this.finishedSegments, this.workingSegment];
	}
}