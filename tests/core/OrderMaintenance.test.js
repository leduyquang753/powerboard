import {assert, test} from "vitest";

import OrderMaintenance from "$lib/core/OrderMaintenance.js";

test("Should maintain order when added sequentially", () => {
	const orderMaintenance = new OrderMaintenance();
	const nodes = [];
	for (let i = 0; i < 10000; ++i) nodes.push(orderMaintenance.addNewAfter(orderMaintenance.tail));
	for (let i = 1; i < 10000; ++i) assert(nodes[i - 1].tag < nodes[i].tag);
});

test("Should maintain order when added in reserve order", () => {
	const orderMaintenance = new OrderMaintenance();
	const nodes = [];
	for (let i = 0; i < 10000; ++i) nodes.push(orderMaintenance.addNewAfter(orderMaintenance.head));
	for (let i = 1; i < 10000; ++i) assert(nodes[i - 1].tag > nodes[i].tag);
});

test("Should maintain order when added to the middle", () => {
	const orderMaintenance = new OrderMaintenance();
	const originalNodes = [];
	for (let i = 0; i < 1000; ++i) originalNodes.push(orderMaintenance.addNewAfter(orderMaintenance.tail));
	const newNodes = [];
	for (let i = 10; i <= 1000; i += 10) newNodes.push(
		...originalNodes.slice(i - 10, i),
		orderMaintenance.addNewAfter(originalNodes[i - 1])
	);
	const totalNodes = newNodes.length;
	for (let i = 1; i < totalNodes; ++i) assert(newNodes[i - 1].tag < newNodes[i].tag);
});

test("Should maintain order when some are removed", () => {
	const orderMaintenance = new OrderMaintenance();
	const originalNodes = [];
	for (let i = 0; i < 1000; ++i) originalNodes.push(orderMaintenance.addNewAfter(orderMaintenance.tail));
	const newNodes = [];
	for (let i = 10; i <= 1000; i += 10) {
		newNodes.push(...originalNodes.slice(i - 10, i - 1));
		orderMaintenance.remove(originalNodes[i - 1]);
	}
	const totalNodes = newNodes.length;
	for (let i = 1; i < totalNodes; ++i) assert(newNodes[i - 1].tag < newNodes[i].tag);
});

test("Should maintain order when added to the middle and some are removed", () => {
	const orderMaintenance = new OrderMaintenance();
	const originalNodes = [];
	for (let i = 0; i < 1000; ++i) originalNodes.push(orderMaintenance.addNewAfter(orderMaintenance.tail));
	const newNodes = [];
	for (let i = 10; i <= 1000; i += 10) {
		if (i / 10 % 2 === 0) {
			newNodes.push(
				...originalNodes.slice(i - 10, i),
				orderMaintenance.addNewAfter(originalNodes[i - 1])
			);
		} else {
			newNodes.push(...originalNodes.slice(i - 10, i - 1));
			orderMaintenance.remove(originalNodes[i - 1]);
		}
	}
	const totalNodes = newNodes.length;
	for (let i = 1; i < totalNodes; ++i) assert(newNodes[i - 1].tag < newNodes[i].tag);
});