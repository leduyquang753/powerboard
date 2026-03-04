import {Bezier} from "bezier-js";

function pointInsideRectangle(point, minX, minY, maxX, maxY) {
	return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function interpolate(p1, p2, t) {
	return [
		p1[0] + (p2[0] - p1[0]) * t,
		p1[1] + (p2[1] - p1[1]) * t,
		p1[2] + (p2[2] - p1[2]) * t
	];
}

/*
function makeSecondDerivativeFunction(points) {
	// The derivative of a cubic Bezier curve is a quadratic Bezier curve.
	const first = [
		[3 * (points[1].x - points[0].x), 3 * (points[1].y - points[0].y)],
		[3 * (points[2].x - points[1].x), 3 * (points[2].y - points[1].y)],
		[3 * (points[3].x - points[2].x), 3 * (points[3].y - points[2].y)]
	];
	// The derivative of a quadratic Bezier curve is a line segment.
	const secondX1 = 2 * (first[1][0] - first[0][0]);
	const secondY1 = 2 * (first[1][1] - first[0][1]);
	const secondX2 = 2 * (first[2][0] - first[1][0]);
	const secondY2 = 2 * (first[2][1] - first[1][1]);
	return t => ({x: secondX1 + (secondX2 - secondX1) * t, y: secondY1 + (secondY2 - secondY1) * t});
}
*/

function erasePointOrLine(points, minX, minY, maxX, maxY) {
	if (points.length === 1) return pointInsideRectangle({x: points[0][0], y: points[0][1]}, minX, minY, maxX, maxY) ? [] : null;
	const point1 = points[0];
	const point2 = points[1];
	const bx = point1[0];
	const by = point1[1];
	const dx = point2[0] - point1[0];
	const dy = point2[1] - point1[1];
	const p = [-dx, dx, -dy, dy];
	const q = [bx - minX, maxX - bx, by - minY, maxY - by];
	let u1 = -Infinity;
	let u2 = Infinity;
	for (let j = 0; j < 4; ++j) {
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
	if (u1 > u2 || (u1 <= 0 && u2 <= 0) || (u1 >= 1 && u2 >= 1)) return null;
	if (u1 <= 0) return u2 >= 1 ? [] : [[interpolate(point1, point2, u2), point2]];
	else return u2 >= 1
		? [[point1, interpolate(point1, point2, u1)]]
		: [
			[point1, interpolate(point1, point2, u1)],
			[interpolate(point1, point2, u2), point2]
		];
}

function eraseBezier(originalSegment, minX, minY, maxX, maxY) {
	const {bezier, startWeight, endWeight} = originalSegment;
	const points = bezier.points;
	// Early out.
	if (
		points.every(point => point.x < minX) || points.every(point => point.x > maxX)
		|| points.every(point => point.y < minY) || points.every(point => point.y > maxY)
	) return null;
	if (points.every(point => pointInsideRectangle(point, minX, minY, maxX, maxY))) return [];

	const rawIntersections = [
		0,
		...bezier.intersects({p1: {x: minX, y: minY}, p2: {x: maxX, y: minY}}),
		...bezier.intersects({p1: {x: minX, y: maxY}, p2: {x: maxX, y: maxY}}),
		...bezier.intersects({p1: {x: minX, y: minY}, p2: {x: minX, y: maxY}}),
		...bezier.intersects({p1: {x: maxX, y: minY}, p2: {x: maxX, y: maxY}}),
		1
	];
	rawIntersections.sort((t1, t2) => t1 - t2);
	const intersections = [rawIntersections[0]];
	for (let i = 1; i < rawIntersections.length; ++i)
		if (rawIntersections[i] !== rawIntersections[i - 1]) intersections.push(rawIntersections[i]);

	const fatteningAmount = Math.min(maxX - minX, maxY - minY) / 100;
	const fatMinX = minX - fatteningAmount;
	const fatMinY = minY - fatteningAmount;
	const fatMaxX = maxX + fatteningAmount;
	const fatMaxY = maxY + fatteningAmount;

	const newSegments = [];
	let lastSegment = null;
	for (let i = 0; i < intersections.length - 1; ++i) {
		const t1 = intersections[i];
		const t2 = intersections[i + 1];
		const subBezier = bezier.split(t1, t2);
		const bbox = subBezier.bbox();
		if (bbox.x.min >= fatMinX && bbox.x.max <= fatMaxX && bbox.y.min >= fatMinY && bbox.y.max <= fatMaxY) continue;
		if (lastSegment !== null && t1 === lastSegment.t2) {
			lastSegment.t2 = t2;
			lastSegment.bezier = null;
		} else {
			lastSegment = {t1, t2, bezier: subBezier};
			newSegments.push(lastSegment);
		}
	}
	if (newSegments.length === 1 && newSegments[0].t1 === 0 && newSegments[0].t2 === 1) return null;
	return newSegments.map(segment => ({
		bezier: segment.bezier ?? bezier.split(segment.t1, segment.t2),
		startWeight: startWeight + (endWeight - startWeight) * segment.t1,
		endWeight: startWeight + (endWeight - startWeight) * segment.t2
	}));
	/*
	const secondDerivative = makeSecondDerivativeFunction(points);
	const intersections = [];
	// We are only interested in intersections where the curve crosses from one side of the line to the other.
	// If the first derivative of the relevant coordinate at the point is nonzero then it crosses.
	// Otherwise, if the second derivative is zero then it is an inflection point that still makes the curve cross to
	// the other side; if not, the point is an extremum for the coordinate, i.e. the curve exits to the same side that
	// it entered.
	for (const t of bezier.intersects({p1: {x: minX, y: minY}, p2: {x: maxX, y: minY}}))
		if (derivativeY !== 0 || secondDerivative(t).y === 0) intersections.push(t);
	for (const t of bezier.intersects({p1: {x: minX, y: maxY}, p2: {x: maxX, y: maxY}}))
		if (derivativeY !== 0 || secondDerivative(t).y === 0) intersections.push(t);
	for (const t of bezier.intersects({p1: {x: minX, y: minY}, p2: {x: minX, y: maxY}}))
		if (derivativeX !== 0 || secondDerivative(t).x === 0) intersections.push(t);
	for (const t of bezier.intersects({p1: {x: maxX, y: minY}, p2: {x: maxX, y: maxY}}))
		if (derivativeX !== 0 || secondDerivative(t).x === 0) intersections.push(t);
	intersections.sort((i1, i2) => i1.t - i2.t);
	intersections.unshift({t: 0, goingIn: pointInsideRectangle(points[0], minX, minY, maxX, maxY)});
	intersections.unshift({t: 1, goingIn: !pointInsideRectangle(points[3], minX, minY, maxX, maxY)});
	// Filter out corners of the rectangle that the curve just passes through while staying outside the rectangle.
	const filteredIntersections = [];
	let lastIntersection = null;
	let discarding = false;
	for (const intersection of intersections) {
		if (lastIntersection !== null && intersection.t === lastIntersection.t) {
			if (!discarding && intersection.goingIn !== lastIntersection.goingIn) discarding = true;
		} else {
			if (!discarding) filteredIntersections.push(lastIntersection);
			lastIntersection = intersection;
		}
	}
	if (filteredIntersections.length === 2) return intersections[0].goingIn ? [] : null;
	*/
}

// Return null if the entire curve is not erased, or an array of remaining curves if it is.
export function eraseStroke(stroke, minX, minY, maxX, maxY) {
	let newStrokes = null;
	if (stroke.isSimple) {
		newStrokes = erasePointOrLine(stroke.basePath, minX, minY, maxX, maxY)
	} else {
		const eraseResults = stroke.spline.map(segment => eraseBezier(segment, minX, minY, maxX, maxY));
		if (eraseResults.every(result => result === null)) return null;
		const newSegments = eraseResults.flatMap((result, i) => result ?? stroke.spline[i]);
		newStrokes = [];
		let lastPoint = null;
		let lastStroke = null;
		for (const newSegment of newSegments) {
			const nextPoint = newSegment.bezier.points[0];
			if (lastPoint !== null && nextPoint.x === lastPoint.x && nextPoint.y === lastPoint.y) {
				lastStroke.push(newSegment);
			} else {
				lastStroke = [newSegment];
				newStrokes.push(lastStroke);
			}
			lastPoint = newSegment.bezier.points[3];
		}
	}
	return newStrokes === null ? null : newStrokes.map(newStroke => ({
		isDraft: false,
		isSimple: stroke.isSimple,
		size: stroke.size,
		color: stroke.color,
		basePath: newStroke,
		spline: newStroke
	}));
}