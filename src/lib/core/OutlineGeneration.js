import {Bezier} from "bezier-js";

import {findBezierCriticalPoints} from "./BezierCriticalPointFinder.js";

const DISCONNECTION_THRESHOLD = 1e-6;
const COLLINEAR_THRESHOLD = 1e-6;

function bezierBeginTangent(bezier) {
	const points = bezier.points;
	for (let i = 1; i < 4; ++i) {
		const dx = points[i].x - points[0].x;
		const dy = points[i].y - points[0].y;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length !== 0) return [dx / length, dy / length];
	}
	return [0, 1];
}

function bezierEndTangent(bezier) {
	const points = bezier.points;
	for (let i = 2; i >= 0; --i) {
		const dx = points[3].x - points[i].x;
		const dy = points[3].y - points[i].y;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length !== 0) return [dx / length, dy / length];
	}
	return [0, 1];
}

function normalVector(vector) {
	return [-vector[1], vector[0]];
}

function solveQuadratic(a, b, c) {
	if (a === 0) return b === 0 ? [] : [-c/b];
	const d = b*b - 4*a*c;
	if (d < 0) return [];
	if (d === 0) return [b / a / -2];
	const sqrtD = Math.sqrt(d);
	return [(b + sqrtD) / a / -2, (b - sqrtD) / a / -2];
}

function pointsAreCollinear(a, b, c) {
	const dx1 = b.x - a.x;
	const dy1 = b.y - a.y;
	const dx2 = c.x - a.x;
	const dy2 = c.y - a.y;
	// Magnitude of cross product is very small compared to absolute value of dot product.
	return Math.abs(dx1*dy2 - dy1*dx2) / Math.abs(dx1*dy1 + dx2*dy2) < COLLINEAR_THRESHOLD;
}

// When the cubic Bezier curve is approximately a straight line (all control points are collinear), find t values where
// the curve changes direction.
function findStraightLineTurns(points) {
	if (!pointsAreCollinear(points[0], points[1], points[2]) || !pointsAreCollinear(points[1], points[2], points[3]))
		return [];
	const [a, b, c, d] = Math.abs(points[3].x - points[0].x) > Math.abs(points[3].y - points[0].y)
		? points.map(p => p.x)
		: points.map(p => p.y);
	const ba = b - a;
	const cb = c - b;
	const dc = d - c;
	// Solve for B'(t) = 3(1 - t)²(b - a) + 6(1 - t)t(c - b) + 3t²(d - c) = 0.
	return solveQuadratic(
		3*ba - 6*cb + 3*dc,
		-6*ba + 6*cb,
		3*ba
	).filter(t => t > 0 && t < 1);
}

function updateBoundingBox(current, incomingMinX, incomingMinY, incomingMaxX, incomingMaxY) {
	current.minX = Math.min(current.minX, incomingMinX);
	current.minY = Math.min(current.minY, incomingMinY);
	current.maxX = Math.max(current.maxX, incomingMaxX);
	current.maxY = Math.max(current.maxY, incomingMaxY);
}

function generateOutlineAndBoundingBoxForProcessedSegments(segments, halfStrokeSize) {
	const segmentCount = segments.length;
	const firstSegment = segments[0];
	const firstSegmentPoints = firstSegment.bezier.points;
	const firstTangent = bezierBeginTangent(firstSegment.bezier);
	const firstNormal = normalVector(firstTangent);
	const firstOffset = firstSegment.startOffset;
	let pathString
		= `M${firstSegmentPoints[0].x - firstNormal[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y - firstNormal[1] * firstOffset}`
		+ `A${firstOffset} ${firstOffset} 0 0 0`
		+ ` ${firstSegmentPoints[0].x - firstTangent[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y - firstTangent[1] * firstOffset}`
		+ `A${firstOffset} ${firstOffset} 0 0 0`
		+ ` ${firstSegmentPoints[0].x + firstNormal[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y + firstNormal[1] * firstOffset}`;
	for (const segment of segments) pathString += segment.forwardPath;
	const lastSegment = segments[segmentCount - 1];
	const lastSegmentPoints = lastSegment.bezier.points;
	const lastTangent = bezierEndTangent(lastSegment.bezier);
	const lastNormal = normalVector(lastTangent);
	const lastOffset = lastSegment.endOffset;
	pathString
		+= `A${lastOffset} ${lastOffset} 0 0 0`
		+ ` ${lastSegmentPoints[3].x + lastTangent[0] * lastOffset}`
		+ ` ${lastSegmentPoints[3].y + lastTangent[1] * lastOffset}`
		+ `A${lastOffset} ${lastOffset} 0 0 0`
		+ ` ${lastSegmentPoints[3].x - lastNormal[0] * lastOffset}`
		+ ` ${lastSegmentPoints[3].y - lastNormal[1] * lastOffset}`;
	for (let i = segmentCount - 1; i >= 0; --i) pathString += segments[i].reversePath;
	pathString += "Z";

	const boundingBox = {...segments[0].boundingBox};
	for (let i = 1; i < segmentCount; ++i) {
		const segmentBoundingBox = segments[i].boundingBox;
		updateBoundingBox(
			boundingBox,
			segmentBoundingBox.minX, segmentBoundingBox.minY,
			segmentBoundingBox.maxX, segmentBoundingBox.maxY
		);
	}
	return {pathString, boundingBox};
}

function processSubsegment(segment, halfStrokeSize, startT, endT) {
	const bezier = segment.bezier.split(startT, endT);
	const startOffset = (segment.startWeight + (segment.endWeight - segment.startWeight) * startT) * halfStrokeSize;
	const endOffset = (segment.startWeight + (segment.endWeight - segment.startWeight) * endT) * halfStrokeSize;

	const firstPoint = bezier.points[0];
	const lastPoint = bezier.points[3];
	let boundingBox = {
		minX: firstPoint.x - halfStrokeSize,
		minY: firstPoint.y - halfStrokeSize,
		maxX: firstPoint.x + halfStrokeSize,
		maxY: firstPoint.y + halfStrokeSize
	};
	updateBoundingBox(
		boundingBox,
		lastPoint.x - halfStrokeSize,
		lastPoint.y - halfStrokeSize,
		lastPoint.x + halfStrokeSize,
		lastPoint.y + halfStrokeSize
	);

	let forwardPath = "";
	let lastT = 0;
	for (const subcurve of bezier.reduce()) {
		const subcurveStartOffset = startOffset + (endOffset - startOffset) * subcurve._t1;
		const subcurveEndOffset = startOffset + (endOffset - startOffset) * subcurve._t2;
		const offsetPoints
			= subcurve.scale(t => subcurveStartOffset + (subcurveEndOffset - subcurveStartOffset) * t).points;
		// `bezier.reduce()` may have missing segments. Recover from those situations by drawing a straight line
		// as a substitute for the offset segment of those missing segments.
		if (Math.abs(subcurve._t1 - lastT) > DISCONNECTION_THRESHOLD)
			forwardPath += `L${offsetPoints[0].x} ${offsetPoints[0].y}`;
		forwardPath
			+= `C${offsetPoints[1].x} ${offsetPoints[1].y}`
			+ ` ${offsetPoints[2].x} ${offsetPoints[2].y}`
			+ ` ${offsetPoints[3].x} ${offsetPoints[3].y}`;
		const subBoundingBox = subcurve.bbox();
		updateBoundingBox(
			boundingBox,
			subBoundingBox.x.min - halfStrokeSize,
			subBoundingBox.y.min - halfStrokeSize,
			subBoundingBox.x.max - halfStrokeSize,
			subBoundingBox.y.max - halfStrokeSize
		);
		lastT = subcurve._t2;
	}
	if (lastT !== 1) {
		const endPoint = bezier.points[3];
		const endNormal = normalVector(bezierEndTangent(bezier));
		forwardPath += `L${endPoint.x + endNormal[0] * endOffset} ${endPoint.y + endNormal[1] * endOffset}`;
	}
	const reverseBezier = new Bezier(...bezier.points.toReversed().map(p => ({x: p.x, y: p.y})));
	let reversePath = "";
	lastT = 0;
	for (const subcurve of reverseBezier.reduce()) {
		const subcurveStartOffset = endOffset + (startOffset - endOffset) * subcurve._t1;
		const subcurveEndOffset = endOffset + (startOffset - endOffset) * subcurve._t2;
		const offsetPoints
			= subcurve.scale(t => subcurveStartOffset + (subcurveEndOffset - subcurveStartOffset) * t).points;
		if (Math.abs(subcurve._t1 - lastT) > DISCONNECTION_THRESHOLD)
			reversePath += `L${offsetPoints[0].x} ${offsetPoints[0].y}`;
		reversePath
			+= `C${offsetPoints[1].x} ${offsetPoints[1].y}`
			+ ` ${offsetPoints[2].x} ${offsetPoints[2].y}`
			+ ` ${offsetPoints[3].x} ${offsetPoints[3].y}`;
		const subBoundingBox = subcurve.bbox();
		updateBoundingBox(
			boundingBox,
			subBoundingBox.x.min - halfStrokeSize,
			subBoundingBox.y.min - halfStrokeSize,
			subBoundingBox.x.max - halfStrokeSize,
			subBoundingBox.y.max - halfStrokeSize
		);
		lastT = subcurve._t2;
	}
	if (lastT !== 1) {
		const endPoint = reverseBezier.points[3];
		const endNormal = normalVector(bezierEndTangent(bezier));
		reversePath += `L${endPoint.x - endNormal[0] * startOffset} ${endPoint.y - endNormal[1] * startOffset}`;
	}
	return {bezier, startOffset, endOffset, forwardPath, reversePath, boundingBox};
}

export function generateOutlineAndBoundingBox(stroke) {
	const halfStrokeSize = stroke.size / 2;
	const spline = stroke.spline;
	if (stroke.isSimple) {
		const points = stroke.basePath;
		if (points.length === 1) {
			const point = points[0];
			const radius = point[2] * halfStrokeSize;
			return {
				pathString: `M${point[0]} ${point[1] - radius}`
					+ `A${radius} ${radius} 0 0 0 ${point[0]} ${point[1] + radius}`
					+ `A${radius} ${radius} 0 0 0 ${point[0]} ${point[1] - radius}`
					+ `Z`,
				minX: point[0] - radius,
				minY: point[1] - radius,
				maxX: point[0] + radius,
				maxY: point[1] + radius
			};
		} else if (points.length === 2) {
			const dx = points[1][0] - points[0][0];
			const dy = points[1][1] - points[0][1];
			const length = Math.sqrt(dx * dx + dy * dy);
			const normal = [-dy / length, dx / length];
			const startOffset = points[0][2] * halfStrokeSize;
			const endOffset = points[1][2] * halfStrokeSize;
			const firstPointSmaller = points[0][2] < points[1][2];
			return {
				pathString: `M${points[0][0] + normal[0] * startOffset} ${points[0][1] + normal[1] * startOffset}`
					+ `L${points[1][0] + normal[0] * endOffset} ${points[1][1] + normal[1] * endOffset}`
					+ `A${endOffset} ${endOffset} 0 ${firstPointSmaller ? 1 : 0} 0`
					+ ` ${points[1][0] - normal[0] * endOffset} ${points[1][1] - normal[1] * endOffset}`
					+ `L${points[0][0] - normal[0] * startOffset} ${points[0][1] - normal[1] * startOffset}`
					+ `A${startOffset} ${startOffset} 0 ${firstPointSmaller ? 0 : 1} 0`
					+ ` ${points[0][0] + normal[0] * startOffset} ${points[0][1] + normal[1] * startOffset}`
					+ `Z`,
				minX: Math.min(points[0][0] - startOffset, points[1][0] - endOffset),
				minY: Math.min(points[0][1] - startOffset, points[1][1] - endOffset),
				maxX: Math.max(points[0][0] + startOffset, points[1][0] + endOffset),
				maxY: Math.max(points[0][1] + startOffset, points[1][1] + endOffset)
			};
		} else {
			throw new Error("Supposedly \"simple\" stroke has too many points.");
		}
		return;
	}
	for (const segment of spline) {
		if ("processed" in segment) continue;
		const processed = [];
		const {bezier, startWeight, endWeight} = segment;
		const startOffset = startWeight * halfStrokeSize;
		const endOffset = endWeight * halfStrokeSize;
		// If this happens, chances are the current and previous segments make a sharp turn.
		// Render them separately to reduce ugly artifacts.
		if (bezier.points[0].x === bezier.points[1].x && bezier.points[0].y === bezier.points[1].y)
			processed.push(null);
		const criticalTs = [
			{t: 0, isTurn: false},
			{t: 1, isTurn: false},
			...findBezierCriticalPoints(bezier.points.map(p => [p.y, p.y]), startOffset, endOffset)
				.map(t => ({t, isTurn: false})),
			...findStraightLineTurns(bezier.points).map(t => ({t, isTurn: true}))
		].sort((a, b) => a.t - b.t).filter((entry, i, a) => i === 0 || entry.t !== a[i - 1].t);
		let lastStart = null;
		let lastEnd = null;
		for (let i = 1; i < criticalTs.length; ++i) {
			const entry = criticalTs[i];
			if (entry.isTurn) {
				if (lastStart != null)
					processed.push(processSubsegment(segment, halfStrokeSize, lastStart, entry.t));
				lastStart = null;
				lastEnd = null;
			} else {
				const previousT = criticalTs[i - 1].t;
				const m = (previousT + entry.t) / 2;
				const offset = startOffset + (endOffset - startOffset) * m;
				const curvature = bezier.curvature(m);
				if (curvature.k !== 0 && Math.abs(curvature.r) < offset) {
					if (lastStart !== null)
						processed.push(processSubsegment(segment, halfStrokeSize, lastStart, lastEnd));
					if (i === 1 || lastStart !== null) processed.push(null);
					lastStart = null;
					lastEnd = null;
				} else {
					if (lastStart === null) lastStart = previousT;
					lastEnd = entry.t;
				}
			}
		}
		if (lastStart !== null) processed.push(processSubsegment(segment, halfStrokeSize, lastStart, lastEnd));
		// Handle possible sharp turn between the current and next segments.
		if (bezier.points[2].x === bezier.points[3].x && bezier.points[2].y === bezier.points[3].y)
			processed.push(null);
		segment.processed = processed;
	}
	let pathString = "";
	let boundingBox = null;
	let pendingSubsegments = [];
	for (const segment of spline) {
		for (const subsegment of segment.processed) {
			if (subsegment === null) {
				if (pendingSubsegments.length !== 0) {
					const subdata
						= generateOutlineAndBoundingBoxForProcessedSegments(pendingSubsegments, halfStrokeSize);
					pathString += subdata.pathString;
					const subBoundingBox = subdata.boundingBox;
					if (boundingBox === null) boundingBox = {...subBoundingBox};
					else updateBoundingBox(
						boundingBox,
						subBoundingBox.minX,
						subBoundingBox.minY,
						subBoundingBox.maxX,
						subBoundingBox.maxY
					);
					pendingSubsegments = [];
				}
			} else {
				pendingSubsegments.push(subsegment);
			}
		}
	}
	if (pendingSubsegments.length !== 0) {
		const subdata
			= generateOutlineAndBoundingBoxForProcessedSegments(pendingSubsegments, halfStrokeSize);
		pathString += subdata.pathString;
		const subBoundingBox = subdata.boundingBox;
		if (boundingBox === null) boundingBox = {...subBoundingBox};
		else updateBoundingBox(
			boundingBox,
			subBoundingBox.minX,
			subBoundingBox.minY,
			subBoundingBox.maxX,
			subBoundingBox.maxY
		);
	}
	if (pathString.length === 0) {
		const fallbackStroke = {...stroke, isSimple: true, basePath: stroke.basePath.slice(0, 2)};
		return generateOutlineAndBoundingBox(fallbackStroke);
	}
	return {pathString, ...boundingBox};
}