import {Bezier} from "bezier-js";

const catmullRomTension = 0.5;
const bezierConversionFactor = 1 / (6 * catmullRomTension);

// Estimate the point before the first drawn point of a Catmull–Rom spline, based on the first 3 given points.
function estimateInitialPoint(p1, p2, p3) {
	return [p1[0] - (p2[0] - p1[0]) / 10, p1[1] - (p2[1] - p1[1]) / 10];
}

function knotInterval(p1, p2) {
	const dx = p2[0] - p1[0];
	const dy = p2[1] - p1[1];
	return (dx * dx + dy * dy) ** 0.25;
}

function updateBoundingBox(current, incomingMinX, incomingMinY, incomingMaxX, incomingMaxY) {
	current.minX = Math.min(current.minX, incomingMinX);
	current.minY = Math.min(current.minY, incomingMinY);
	current.maxX = Math.max(current.maxX, incomingMaxX);
	current.maxY = Math.max(current.maxY, incomingMaxY);
}

// Use Catmull–Rom spline interpolation to generate a cubic Bezier spline through the given points.
export function generateBezierSpline(rawPoints) {
	let pointCount = rawPoints.length;
	const points = [
		estimateInitialPoint(rawPoints[0], rawPoints[1], rawPoints[2]),
		...rawPoints,
		estimateInitialPoint(rawPoints[pointCount - 1], rawPoints[pointCount - 2], rawPoints[pointCount - 3])
	];
	pointCount += 2;
	const result = [];
	for (let i = 1; i < pointCount - 2; ++i) {
		const t1 = knotInterval(points[i - 1], points[i]);
		const t2 = t1 + knotInterval(points[i], points[i + 1]);
		const t3 = t2 + knotInterval(points[i + 1], points[i + 2]);
		const c1 = (t2 - t1) / t2;
		const c2 = t1 / t2;
		const d1 = (t3 - t2) / (t3 - t1);
		const d2 = (t2 - t1) / (t3 - t1);
		const M1x = (t2 - t1) * (
			c1 * (points[i][0] - points[i - 1][0]) / t1
			+ c2 * (points[i + 1][0] - points[i][0]) / (t2 - t1)
		);
		const M1y = (t2 - t1) * (
			c1 * (points[i][1] - points[i - 1][1]) / t1
			+ c2 * (points[i + 1][1] - points[i][1]) / (t2 - t1)
		);
		const M2x = (t2 - t1) * (
			d1 * (points[i + 1][0] - points[i][0]) / (t2 - t1)
			+ d2 * (points[i + 2][0] - points[i + 1][0]) / (t3 - t2)
		);
		const M2y = (t2 - t1) * (
			d1 * (points[i + 1][1] - points[i][1]) / (t2 - t1)
			+ d2 * (points[i + 2][1] - points[i + 1][1]) / (t3 - t2)
		);
		result.push({
			bezier: new Bezier(
				points[i][0], points[i][1],
				points[i][0] + M1x / 3, points[i][1] + M1y / 3,
				points[i + 1][0] - M2x / 3, points[i + 1][1] - M2y / 3,
				points[i + 1][0], points[i + 1][1]
			),
			startWeight: points[i][2],
			endWeight: points[i + 1][2]
		});
	}
	return result;
}

// Generate an SVG path string representing an outline for a stroke with the given points.
export function generateOutlineAndBoundingBox(stroke) {
	const halfStrokeSize = stroke.size / 2;
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
	const spline = stroke.basePath;
	const segmentCount = spline.length;
	const firstSegment = spline[0];
	const firstSegmentPoints = firstSegment.bezier.points;
	const firstNormal = (() => {
		for (let i = 1; i < 4; ++i) {
			const dx = firstSegmentPoints[i].x - firstSegmentPoints[0].x;
			const dy = firstSegmentPoints[i].y - firstSegmentPoints[0].y;
			const length = Math.sqrt(dx * dx + dy * dy);
			if (length !== 0) return [-dy / length, dx / length];
		}
		return [0, 1];
	})();
	const firstOffset = firstSegment.startWeight * halfStrokeSize;
	let path
		= `M${firstSegmentPoints[0].x - firstNormal[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y - firstNormal[1] * firstOffset}`
		+ `A${firstOffset} ${firstOffset} 0 ${firstSegment.startWeight < firstSegment.endWeight ? 0 : 1} 0`
		+ ` ${firstSegmentPoints[0].x + firstNormal[0] * firstOffset}`
		+ ` ${firstSegmentPoints[0].y + firstNormal[1] * firstOffset}`;
	let boundingBox = {
		minX: firstSegmentPoints[0].x - firstOffset,
		minY: firstSegmentPoints[0].x - firstOffset,
		maxX: firstSegmentPoints[1].x + firstOffset,
		maxY: firstSegmentPoints[1].x + firstOffset
	};
	for (let i = 0; i < segmentCount; ++i) {
		const {bezier, startWeight, endWeight} = spline[i];
		const startOffset = startWeight * halfStrokeSize;
		const endOffset = endWeight * halfStrokeSize;
		const totalLength = bezier.length();
		let lastT = 0;
		for (const subcurve of bezier.reduce()) {
			const subcurveStartOffset = startOffset + (endOffset - startOffset) * subcurve._t1;
			const subcurveEndOffset = startOffset + (endOffset - startOffset) * subcurve._t2;
			const offsetPoints
				= subcurve.scale(t => subcurveStartOffset + (subcurveEndOffset - subcurveStartOffset) * t).points;
			// `bezier.reduce()` may have missing segments. Recover from those situations by drawing a straight line
			// as a substitute for the offset segment of those missing segments.
			if (Math.abs(subcurve._t1 - lastT) > 1e-6) path += `L${offsetPoints[1].x} ${offsetPoints[1].y}`;
			path
				+= `C${offsetPoints[1].x} ${offsetPoints[1].y}`
				+ ` ${offsetPoints[2].x} ${offsetPoints[2].y}`
				+ ` ${offsetPoints[3].x} ${offsetPoints[3].y}`;
			const subBoundingBox = subcurve.bbox();
			updateBoundingBox(
				boundingBox, subBoundingBox.x.min, subBoundingBox.y.min, subBoundingBox.x.max, subBoundingBox.y.max
			);
			lastT = subcurve._t2;
		}
		if (lastT !== 1) {
			const bezierPoints = bezier.points;
			const endPoint = bezierPoints[3];
			const endNormal = (() => {
				for (let i = 2; i >= 0; --i) {
					const dx = bezierPoints[3].x - bezierPoints[i].x;
					const dy = bezierPoints[3].y - bezierPoints[i].y;
					const length = Math.sqrt(dx * dx + dy * dy);
					if (length !== 0) return [-dy / length, dx / length];
				}
				return [0, 1];
			})();
			path += `L${endPoint.x + endNormal[0] * endOffset} ${endPoint.y + endNormal[1] * endOffset}`;
		}
	}
	const lastSegment = spline[segmentCount - 1];
	const lastSegmentPoints = lastSegment.bezier.points;
	const lastNormal = (() => {
		for (let i = 2; i >= 0; --i) {
			const dx = lastSegmentPoints[3].x - lastSegmentPoints[i].x;
			const dy = lastSegmentPoints[3].y - lastSegmentPoints[i].y;
			const length = Math.sqrt(dx * dx + dy * dy);
			if (length !== 0) return [-dy / length, dx / length];
		}
		return [0, 1];
	})();
	const lastOffset = lastSegment.endWeight * halfStrokeSize;
	path
		+= `A${lastOffset} ${lastOffset} 0 ${lastSegment.startWeight < lastSegment.endWeight ? 1 : 0} 0`
		+ ` ${lastSegmentPoints[3].x - lastNormal[0] * lastOffset}`
		+ ` ${lastSegmentPoints[3].y - lastNormal[1] * lastOffset}`;
	updateBoundingBox(
		boundingBox,
		lastSegmentPoints[3].x - lastOffset, lastSegmentPoints[3].y - lastOffset,
		lastSegmentPoints[3].x + lastOffset, lastSegmentPoints[3].y + lastOffset
	);
	for (let i = segmentCount - 1; i >= 0; --i) {
		const {bezier: originalBezier, startWeight, endWeight} = spline[i];
		const originalPoints = originalBezier.points;
		const bezier = new Bezier(
			originalPoints[3].x, originalPoints[3].y,
			originalPoints[2].x, originalPoints[2].y,
			originalPoints[1].x, originalPoints[1].y,
			originalPoints[0].x, originalPoints[0].y
		);
		const startOffset = endWeight * halfStrokeSize;
		const endOffset = startWeight * halfStrokeSize;
		let lastT = 0;
		for (const subcurve of bezier.reduce()) {
			const subcurveStartOffset = startOffset + (endOffset - startOffset) * subcurve._t1;
			const subcurveEndOffset = startOffset + (endOffset - startOffset) * subcurve._t2;
			const offsetPoints
				= subcurve.scale(t => subcurveStartOffset + (subcurveEndOffset - subcurveStartOffset) * t).points;
			if (Math.abs(subcurve._t1 - lastT) > 1e-6) path += `L${offsetPoints[1].x} ${offsetPoints[1].y}`;
			path
				+= `C${offsetPoints[1].x} ${offsetPoints[1].y}`
				+ ` ${offsetPoints[2].x} ${offsetPoints[2].y}`
				+ ` ${offsetPoints[3].x} ${offsetPoints[3].y}`;
			const subBoundingBox = subcurve.bbox();
			updateBoundingBox(
				boundingBox, subBoundingBox.x.min, subBoundingBox.y.min, subBoundingBox.x.max, subBoundingBox.y.max
			);
			lastT = subcurve._t2;
		}
		if (lastT !== 1) {
			const bezierPoints = bezier.points;
			const endPoint = bezierPoints[3];
			const endNormal = (() => {
				for (let i = 2; i >= 0; --i) {
					const dx = bezierPoints[3].x - bezierPoints[i].x;
					const dy = bezierPoints[3].y - bezierPoints[i].y;
					const length = Math.sqrt(dx * dx + dy * dy);
					if (length !== 0) return [-dy / length, dx / length];
				}
				return [0, 1];
			})();
			path += `L${endPoint.x + endNormal[0] * endOffset} ${endPoint.y + endNormal[1] * endOffset}`;
		}
	}
	path += "Z";
	return {pathString: path, ...boundingBox};
}