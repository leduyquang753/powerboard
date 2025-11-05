/*
	Implementation of the "tag-range relabeling algorithm" for order maintenance by Michael A. Bender et al.
	https://doi.org/10.1007/3-540-45749-6_17
*/

// The base constant for the overflow threshold. A range of size 2^i is in overflow when its density exceeds T^(-i),
// in other words, when the number of elements exceeds (2:T)^i.
const T = 1.5;
const overflowThresholdBase = 2 / T;

export default class OrderMaintenance {
	constructor() {
		this.tagBits = 32n;
		this.maxTag = (1n << this.tagBits) - 1n;
		this.tail = {
			tag: 0n,
			previous: null,
			next: null
		};
	}

	#insertNode(previous) {
		const next = previous.next;
		const nextTag = next === null ? this.maxTag + 1n : next.tag;
		const node = {
			tag: previous.tag + (nextTag - previous.tag) / 2n,
			previous, next
		};
		previous.next = node;
		if (next === null) this.tail = node;
		else next.previous = node;
		return node;
	}

	addNewAfter(ancestor) {
		// If there is available space, use it.
		if (ancestor.next === null && ancestor.tag != this.maxTag) return this.#insertNode(ancestor);
		// Find the smallest tag range that is not overflowing.
		let elementsInRange = 1n;
		let rangeFirst = ancestor;
		let rangeLast = ancestor;
		let rangePrefix;
		let level;
		for (level = 1n; level <= this.tagBits; ++level) {
			rangePrefix = ancestor.tag >> level;
			while (rangeFirst.previous !== null && rangeFirst.previous.tag >> level === rangePrefix) {
				++elementsInRange;
				rangeFirst = rangeFirst.previous;
			}
			while (rangeLast.next !== null && rangeLast.next.tag >> level === rangePrefix) {
				++elementsInRange;
				rangeLast = rangeLast.next;
			}
			const overflowThreshold = BigInt(Math.trunc(Math.pow(overflowThresholdBase, Number(level))));
			if (elementsInRange <= overflowThreshold) break;
		}
		if (level > this.tagBits) {
			// We need an extra tag bit.
			++this.tagBits;
			this.maxTag = (1n << this.tagBits) - 1n;
		}
		// Relabel the elements in the range.
		const rangeFirstTag = rangePrefix << level;
		const rangeSize = 1n << level;
		let currentNode = rangeFirst;
		for (let i = 0n; i !== elementsInRange; ++i) {
			currentNode.tag = rangeFirstTag + rangeSize * i / elementsInRange;
			currentNode = currentNode.next;
		}
		// Perform the insert in the newly cleared space.
		if (
			ancestor.tag === this.maxTag
			|| (ancestor.next !== null && ancestor.tag === ancestor.next.tag + 1n)
		) throw new Error("Order maintenance bug: space is not properly cleared.");
		return this.#insertNode(ancestor);
	}

	remove(node) {
		const previous = node.previous;
		if (previous !== null) previous.next = node.next;
		if (node.next === null) this.tail = previous;
		else node.next.previous = previous;
	}
}