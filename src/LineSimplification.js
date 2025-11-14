function interpolate(p1, p2, t) {
	return [
		p1[0] + (p2[0] - p1[0]) * t,
		p1[1] + (p2[1] - p1[1]) * t,
		p1[2] + (p2[2] - p1[2]) * t
	];
}

function squaredDistance(point1, point2) {
	const dx = point1[0] - point2[0];
	const dy = point1[1] - point2[1];
	return dx*dx + dy*dy;
}

function shortestDistance(point, line1, line2) {
	const squaredLength = squaredDistance(line1, line2);
	if (squaredLength === 0) return Math.sqrt(squaredDistance(point, line1));
	const t = Math.max(0, Math.min(
		1,
		((point[0] - line1[0]) * (line2[0] - line1[0]) + (point[1] - line1[1]) * (line2[1] - line1[1])) / squaredLength
	));
	return Math.sqrt(squaredDistance(point, [
		line1[0] + (line2[0] - line1[0]) * t,
		line1[1] + (line2[1] - line1[1]) * t
	]));
}

function verticalDistance(point, line1, line2) {
	if (line1[0] - line2[0] === 0) return Math.abs(point[1] - line1[1]);
	const t = (point[0] - line1[0]) / (line2[0] - line1[0]);
	return Math.abs(point[1] - line1[1] - (line2[1] - line1[1]) * t);
}

// Use the Ramer–Douglas–Peucker algorithm to reduce the number of points of a polyline.
// Return the index of the points that belong to the simplified polyline.
function simplifyPolyline(points, distanceFunction, tolerance) {
	const result = [];
	const stack = [[0, points.length, true]];
	while (stack.length !== 0) {
		const [start, end, includeLastPoint] = stack.pop();
		const line1 = points[start];
		const line2 = points[end - 1];
		let maxIndex = start;
		let maxDistance = 0;
		for (let i = start + 1; i < end; ++i) {
			const distance = distanceFunction(points[i], line1, line2);
			if (distance > maxDistance) {
				maxIndex = i;
				maxDistance = distance;
			}
		}
		if (maxDistance > tolerance) {
			stack.push([maxIndex, end, includeLastPoint], [start, maxIndex, false]);
		} else {
			result.push(start);
			if (includeLastPoint) result.push(end - 1);
		}
	}
	const deduplicatedResult = [];
	let lastPoint = null;
	for (const index of result) {
		const point = points[index];
		if (lastPoint !== null && point[0] === lastPoint[0] && point[1] === lastPoint[1]) continue;
		deduplicatedResult.push(index);
		lastPoint = point;
	}
	return deduplicatedResult;
}

const weightTolerance = 0.1;
const positionTolerance = 1;

// Heuristic: We expect the pointer to move slowly when approaching a corner. If the distance between the candidate
// corner point and the original sampled point before it is not greater than this, then it is sufficiently slow to
// be detected as a corner.
// A caveat is when the pointer moves fast diagonally towards an edge of the screen, it creates an angle but the corner
// will be ruled out by this heuristic. In the future, a more robust algorithm might be employed, such as IStraw
// (https://doi.org/10.1145/1572741.1572759).
const maxSharpIncomingDistance = 2;
const maxSharpIncomingDistanceSquared = maxSharpIncomingDistance * maxSharpIncomingDistance;
// For sufficiently small and large angles the Catmull–Rom interpolation is satisfactory without adding extra points.
const minSharpAngle = 15 / 180 * Math.PI;
const maxSharpCosine = Math.cos(minSharpAngle);
const maxSharpAngle = 120 / 180 * Math.PI;
const minSharpCosine = Math.cos(maxSharpAngle);

export function simplifyStroke(points, strokeSize) {
	// First stage: determine subpolylines where the weight changes nearly linearly.
	// This ensures points with important weight changes are not removed.
	const firstStagePoints = [[0, points[0][2]]];
	let cumulativeDistance = 0;
	const pointCount = points.length;
	for (let i = 1; i < pointCount; ++i) {
		cumulativeDistance += Math.sqrt(squaredDistance(points[i - 1], points[i]));
		firstStagePoints.push([cumulativeDistance, points[i][2]]);
	}
	const firstStageIndices = simplifyPolyline(firstStagePoints, verticalDistance, weightTolerance);
	const firstStageIndexCount = firstStageIndices.length;

	// Second stage: simplify each subpolyline from the first stage.
	const secondStagePoints = [];
	for (let i = 0; i < firstStageIndexCount - 1; ++i) {
		const firstStageIndex = firstStageIndices[i];
		const subpoints = points.slice(firstStageIndex, firstStageIndices[i + 1] + 1);
		const secondStageIndices = simplifyPolyline(subpoints, shortestDistance, positionTolerance);
		for (let j = (i === 0 ? 0 : 1); j < secondStageIndices.length; ++j) {
			const secondStageIndex = secondStageIndices[j];
			const subpoint = subpoints[secondStageIndex];
			subpoint.originalIndex = firstStageIndex + secondStageIndex;
			secondStagePoints.push(subpoint);
		}
	}

	// Third stage: process sharp corners.
	// Because the stroke will be fitted using a Catmull–Rom spline, there will be bulges on the sides of sharp corners
	// that the user intends to be straight. This is remedied by inserting two extra points close to the corner to guide
	// the edges in a nearly straight path towards the corner.
	const sharpCornerMinEdgeLength = strokeSize * 2;
	const secondStagePointCount = secondStagePoints.length;
	const result = [secondStagePoints[0]];
	for (let i = 1; i < secondStagePointCount - 1; ++i) {
		const currentPoint = secondStagePoints[i];

		const originalPointBefore = points[secondStagePoints[i].originalIndex - 1];
		const incomingDx = originalPointBefore[0] - currentPoint[0];
		const incomingDy = originalPointBefore[1] - currentPoint[1];
		const incomingLengthSquared = incomingDx * incomingDx + incomingDy * incomingDy;

		const dx1 = secondStagePoints[i - 1][0] - secondStagePoints[i][0];
		const dy1 = secondStagePoints[i - 1][1] - secondStagePoints[i][1];
		const dx2 = secondStagePoints[i + 1][0] - secondStagePoints[i][0];
		const dy2 = secondStagePoints[i + 1][1] - secondStagePoints[i][1];
		const length1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
		const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
		const angleCosine = (dx1 * dx2 + dy1 * dy2) / (length1 * length2);
		if (
			incomingLengthSquared > maxSharpIncomingDistanceSquared
			|| length1 < sharpCornerMinEdgeLength || length2 < sharpCornerMinEdgeLength
			|| angleCosine < minSharpCosine || angleCosine > maxSharpCosine
		) {
			result.push(secondStagePoints[i]);
			continue;
		}
		result.push(
			interpolate(secondStagePoints[i - 1], secondStagePoints[i], 1 - strokeSize / length1),
			secondStagePoints[i],
			interpolate(secondStagePoints[i], secondStagePoints[i + 1], strokeSize / length2)
		);
	}
	if (secondStagePointCount > 1) result.push(secondStagePoints[secondStagePointCount - 1]);
	for (const point of result) delete point.originalIndex;
	return result;
}