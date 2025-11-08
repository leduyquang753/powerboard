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
	return result;
}

const weightTolerance = 0.1;
const positionTolerance = 1;

export function simplifyStroke(points) {
	const firstStagePoints = [[0, points[0][2]]];
	let cumulativeDistance = 0;
	const pointCount = points.length;
	for (let i = 1; i < pointCount; ++i) {
		cumulativeDistance += Math.sqrt(squaredDistance(points[i - 1], points[i]));
		firstStagePoints.push([cumulativeDistance, points[i][2]]);
	}
	const firstStageIndices = simplifyPolyline(firstStagePoints, verticalDistance, weightTolerance);
	const firstStageIndexCount = firstStageIndices.length;
	const result = [];
	for (let i = 0; i < firstStageIndexCount - 1; ++i) {
		const subpoints = points.slice(firstStageIndices[i], firstStageIndices[i + 1] + 1);
		const secondStageIndices = simplifyPolyline(subpoints, shortestDistance, positionTolerance);
		if (i !== 0) secondStageIndices.unshift();
		result.push(...secondStageIndices.map(index => subpoints[index]));
	}
	return result;
}